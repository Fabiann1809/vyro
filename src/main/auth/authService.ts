import { z } from 'zod'
import { parseAuthCallback } from './callback'
import {
  requestResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  verifyCodeSchema,
  type AccountStatus,
  type AuthFailure,
  type AuthResult
} from '@shared/account'

type Failed = { error: AuthFailure }
// Whoever is signed in after the call, or null when the call worked but nobody is signed in yet.
type Signed = { email: string } | null

// Who is signed in: the address to show and the id that the data on this computer is tied to.
export interface CurrentUser {
  email: string
  id: string
}

// What the account code needs from the sign-in server, so tests can use a fake one.
export interface AuthGateway {
  // The person whose session is stored (renewed when it expired), or null.
  currentUser: () => Promise<CurrentUser | null>
  signInWithPassword: (email: string, password: string) => Promise<{ email: string } | Failed>
  // Signed in at once only when the project does not ask to confirm the email.
  signUp: (email: string, password: string) => Promise<Signed | Failed>
  // Confirms the email with the code that came in the message and signs the person in.
  verifyEmailCode: (email: string, code: string) => Promise<{ email: string } | Failed>
  requestPasswordReset: (email: string) => Promise<null | Failed>
  // Checks the code, sets the new password and signs the person in.
  resetPassword: (
    email: string,
    code: string,
    password: string
  ) => Promise<{ email: string } | Failed>
  // The address where the person signs in with Google, in the browser (never in the app window).
  startGoogleSignIn: () => Promise<{ url: string } | Failed>
  // Trades the one-time code of the return link for a session.
  completeSignIn: (code: string) => Promise<{ email: string } | Failed>
  signOut: () => Promise<void>
}

const SIGNED_OUT: AccountStatus = { state: 'signed-out' }

// The account in the main process. A null gateway means this build has no Supabase settings.
export class AuthService {
  constructor(
    private readonly gateway: AuthGateway | null,
    // Opens an address in the system browser (the app never shows a provider page itself) and says
    // whether it did: it refuses an address it does not trust.
    private readonly openBrowser: (url: string) => Promise<boolean> = async () => false
  ) {}

  async status(): Promise<AccountStatus> {
    if (!this.gateway) return { state: 'unconfigured' }
    try {
      const user = await this.gateway.currentUser()
      return user ? { state: 'signed-in', email: user.email } : SIGNED_OUT
    } catch {
      return SIGNED_OUT
    }
  }

  // The id of the account that is signed in, for the main process only: the page never needs it.
  async currentUserId(): Promise<string | null> {
    if (!this.gateway) return null
    try {
      return (await this.gateway.currentUser())?.id ?? null
    } catch {
      return null
    }
  }

  signIn(input: unknown): Promise<AuthResult> {
    return this.run(signInSchema, input, (gateway, data) =>
      gateway.signInWithPassword(data.email, data.password)
    )
  }

  // The same answer whether or not the address already has an account, so it cannot be probed.
  signUp(input: unknown): Promise<AuthResult> {
    return this.run(signUpSchema, input, (gateway, data) =>
      gateway.signUp(data.email, data.password)
    )
  }

  verifyEmailCode(input: unknown): Promise<AuthResult> {
    return this.run(verifyCodeSchema, input, (gateway, data) =>
      gateway.verifyEmailCode(data.email, data.code)
    )
  }

  // Also the same answer for any address: whether it exists is not told.
  requestPasswordReset(input: unknown): Promise<AuthResult> {
    return this.run(requestResetSchema, input, (gateway, data) =>
      gateway.requestPasswordReset(data.email)
    )
  }

  resetPassword(input: unknown): Promise<AuthResult> {
    return this.run(resetPasswordSchema, input, (gateway, data) =>
      gateway.resetPassword(data.email, data.code, data.password)
    )
  }

  // Opens Google in the browser. The answer only says it was opened: who signed in arrives later,
  // through handleCallback, when the browser sends the person back to the app.
  async signInWithGoogle(): Promise<AuthResult> {
    if (!this.gateway) return { ok: false, error: 'unconfigured' }
    try {
      const started = await this.gateway.startGoogleSignIn()
      if ('error' in started) return { ok: false, error: started.error }
      if (!(await this.openBrowser(started.url))) return { ok: false, error: 'unknown' }
      return { ok: true, status: SIGNED_OUT }
    } catch {
      return { ok: false, error: 'unknown' }
    }
  }

  // A link that opened the app. Null when it is not a sign-in link, so nothing else can use it.
  async handleCallback(link: string): Promise<AuthResult | null> {
    const callback = parseAuthCallback(link)
    if (!callback) return null
    if (callback.kind === 'failed') return { ok: false, error: 'invalid-code' }
    return this.run(z.object({ code: z.string() }), { code: callback.code }, (gateway, data) =>
      gateway.completeSignIn(data.code)
    )
  }

  async signOut(): Promise<AccountStatus> {
    if (!this.gateway) return { state: 'unconfigured' }
    try {
      await this.gateway.signOut()
    } catch {
      // The stored session is dropped on this computer even if the server could not be told.
    }
    return SIGNED_OUT
  }

  // Validates the input, calls the server and turns the outcome into a result for the page.
  private async run<T>(
    schema: z.ZodType<T>,
    input: unknown,
    call: (gateway: AuthGateway, data: T) => Promise<Signed | Failed>
  ): Promise<AuthResult> {
    if (!this.gateway) return { ok: false, error: 'unconfigured' }
    const parsed = schema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'invalid-input' }
    try {
      const result = await call(this.gateway, parsed.data)
      if (result && 'error' in result) return { ok: false, error: result.error }
      return { ok: true, status: result ? { state: 'signed-in', email: result.email } : SIGNED_OUT }
    } catch {
      // Nothing from the failure is kept: it could carry the address or a token.
      return { ok: false, error: 'unknown' }
    }
  }
}
