import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'

// A stand-in for the account service (Supabase's sign-in API), so that the tests of the app can
// sign in with no network and no real account. It speaks just enough of the protocol for the
// client the app uses, and it follows the same rules that matter to the app: an email has to be
// confirmed with a code, a code works for one person, and a return from Google needs the secret
// that the app made when it started.

export const TEST_USER = { email: 'ana@vyro.test', password: 'correct-horse-battery' }
// What the emails of the fake carry. Nothing is sent: the tests type these.
export const EMAIL_CODE = '123456'
export const RESET_CODE = '654321'
// A return from Google is accepted when its code starts like this.
export const GOOGLE_CODE_PREFIX = 'good-'
// This address stands for a person who has asked for too many emails.
export const RATE_LIMITED_EMAIL = 'limit@vyro.test'
// This person's sessions last one second, to test what happens when the stored one has expired.
export const SHORT_LIVED_EMAIL = 'short@vyro.test'
// This person's account cannot be deleted: the service fails, as when it is broken.
export const UNDELETABLE_EMAIL = 'stuck@vyro.test'

interface Account {
  id: string
  password: string
  confirmed: boolean
}

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url')

function session(id: string, email: string): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  const lifetime = email === SHORT_LIVED_EMAIL ? 1 : 3600
  const user = {
    id,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString()
  }
  const claims = {
    sub: id,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: now + lifetime
  }
  return {
    access_token: `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(claims)}.fake-signature`,
    token_type: 'bearer',
    expires_in: lifetime,
    expires_at: now + lifetime,
    refresh_token: `refresh-${randomUUID()}`,
    user
  }
}

function fail(response: ServerResponse, status: number, code: string): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ code: status, error_code: code, msg: code }))
}

function send(response: ServerResponse, body: unknown, status = 200): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

// The email in the access token that came with a request, or null.
function emailOfToken(request: IncomingMessage): string | null {
  const token = (request.headers['authorization'] ?? '').replace('Bearer ', '')
  try {
    const claims = JSON.parse(
      Buffer.from(token.split('.')[1] ?? 'e30', 'base64url').toString()
    ) as { email?: string }
    return claims.email ?? null
  } catch {
    return null
  }
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ''
  for await (const chunk of request) raw += (chunk as Buffer).toString()
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

export interface FakeAuth {
  url: string
  close: () => Promise<void>
}

export async function startFakeAuth(): Promise<FakeAuth> {
  const accounts = new Map<string, Account>([
    [TEST_USER.email, { id: randomUUID(), password: TEST_USER.password, confirmed: true }],
    [SHORT_LIVED_EMAIL, { id: randomUUID(), password: TEST_USER.password, confirmed: true }],
    [UNDELETABLE_EMAIL, { id: randomUUID(), password: TEST_USER.password, confirmed: true }]
  ])
  // Who each refresh token belongs to, so that a stored session can be renewed.
  const refreshTokens = new Map<string, string>()

  const grant = (response: ServerResponse, email: string): void => {
    const account = accounts.get(email)
    if (!account) return fail(response, 400, 'user_not_found')
    const next = session(account.id, email)
    refreshTokens.set(next['refresh_token'] as string, email)
    send(response, next)
  }

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const body = request.method === 'GET' ? {} : await readBody(request)
    const email = typeof body['email'] === 'string' ? body['email'].toLowerCase() : ''
    const route = `${request.method} ${url.pathname}`

    if (route === 'POST /auth/v1/token') {
      const kind = url.searchParams.get('grant_type')
      if (kind === 'password') {
        const account = accounts.get(email)
        if (!account || account.password !== body['password']) {
          return fail(response, 400, 'invalid_credentials')
        }
        if (!account.confirmed) return fail(response, 400, 'email_not_confirmed')
        return grant(response, email)
      }
      if (kind === 'refresh_token') {
        const owner = refreshTokens.get(String(body['refresh_token']))
        return owner ? grant(response, owner) : fail(response, 400, 'refresh_token_not_found')
      }
      if (kind === 'pkce') {
        const code = String(body['auth_code'] ?? '')
        if (!code.startsWith(GOOGLE_CODE_PREFIX) || !body['code_verifier']) {
          return fail(response, 404, 'flow_state_not_found')
        }
        const google = 'ana.google@vyro.test'
        if (!accounts.has(google))
          accounts.set(google, { id: randomUUID(), password: '', confirmed: true })
        return grant(response, google)
      }
    }

    if (route === 'POST /auth/v1/signup') {
      if (email === RATE_LIMITED_EMAIL) return fail(response, 429, 'over_email_send_rate_limit')
      const existing = accounts.get(email)
      // Like the real service: the same answer for an address that already has an account.
      const account = existing ?? {
        id: randomUUID(),
        password: String(body['password']),
        confirmed: false
      }
      if (!existing) accounts.set(email, account)
      return send(response, {
        id: account.id,
        email,
        aud: 'authenticated',
        role: 'authenticated',
        identities: existing ? [] : [{ provider: 'email' }],
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString()
      })
    }

    if (route === 'POST /auth/v1/verify') {
      const account = accounts.get(email)
      const expected = body['type'] === 'recovery' ? RESET_CODE : EMAIL_CODE
      if (!account || body['token'] !== expected) return fail(response, 403, 'otp_expired')
      account.confirmed = true
      return grant(response, email)
    }

    if (route === 'POST /auth/v1/recover') {
      // Nothing tells whether the address has an account.
      return send(response, {})
    }

    // The functions of the database that erase what belongs to the person who calls them.
    if (
      route === 'POST /rest/v1/rpc/delete_my_account' ||
      route === 'POST /rest/v1/rpc/delete_my_cloud_data'
    ) {
      const caller = emailOfToken(request)
      if (!caller || !accounts.has(caller)) return fail(response, 401, 'bad_jwt')
      if (caller === UNDELETABLE_EMAIL) return fail(response, 500, 'unexpected_failure')
      if (route.endsWith('delete_my_account')) accounts.delete(caller)
      response.writeHead(204)
      return void response.end()
    }

    if (route === 'PUT /auth/v1/user') {
      const claimed = emailOfToken(request)
      const claims = { email: claimed }
      const account = claims.email ? accounts.get(claims.email) : undefined
      if (!account || !claims.email) return fail(response, 401, 'bad_jwt')
      if (body['password'] === 'password') return fail(response, 422, 'weak_password')
      account.password = String(body['password'])
      return send(response, { id: account.id, email: claims.email, aud: 'authenticated' })
    }

    if (route === 'POST /auth/v1/logout') {
      response.writeHead(204)
      return void response.end()
    }

    fail(response, 404, 'not_found')
  }

  const server: Server = createServer((request, response) => {
    handle(request, response).catch(() => fail(response, 500, 'unexpected_failure'))
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((done) => server.close(() => done()))
  }
}
