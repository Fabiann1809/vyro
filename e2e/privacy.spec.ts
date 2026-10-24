import { createServer, type Server } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

// Follows what leaves the app during a whole use of the AI coach: first with the coach off, then
// on. Node code (where the calls to the provider are made) is watched by e2e/netLog.cjs, and the
// page by Playwright, so a request from anywhere shows up.

let app: ElectronApplication | undefined
let userData: string
let netLog: string
let provider: { url: string; origin: string; bodies: unknown[]; close: () => Promise<void> }

async function startProvider(): Promise<typeof provider> {
  const bodies: unknown[] = []
  const server: Server = createServer((request, response) => {
    let raw = ''
    request.on('data', (chunk: Buffer) => (raw += chunk.toString()))
    request.on('end', () => {
      bodies.push(JSON.parse(raw))
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ reply: 'Hola', summary: 'Bien', tip: 'Sigue' })
              },
              finish_reason: 'stop'
            }
          ]
        })
      )
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}/v1`,
    origin: `http://127.0.0.1:${port}`,
    bodies,
    close: () => new Promise<void>((done) => server.close(() => done()))
  }
}

const logged = (): Array<{ via: string; url: string; body: string | null }> =>
  existsSync(netLog)
    ? readFileSync(netLog, 'utf-8')
        .split(String.fromCharCode(10))
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { via: string; url: string; body: string | null })
    : []

// The first line says the watcher is running: without it, "nothing was recorded" would prove nothing.
const recorded = (): ReturnType<typeof logged> => {
  const [loaded, ...requests] = logged()
  expect(loaded?.via).toBe('loaded')
  return requests
}

test.beforeEach(async () => {
  userData = mkdtempSync(join(tmpdir(), 'vyro-privacy-'))
  netLog = join(userData, 'net.jsonl')
  provider = await startProvider()
})

test.afterEach(async () => {
  await app?.close()
  app = undefined
  await provider.close()
  rmSync(userData, { recursive: true, force: true })
})

test('nothing leaves with the AI off, and with it on only numbers and text reach the provider', async () => {
  app = await electron.launch({
    args: [
      '-r',
      resolve('e2e/netLog.cjs'),
      '.',
      `--user-data-dir=${userData}`,
      ...(process.env['CI'] ? ['--no-sandbox'] : [])
    ],
    env: {
      ...process.env,
      VYRO_NET_LOG: netLog
    }
  })
  const page = await app.firstWindow()
  const pageRequests: string[] = []
  page.context().on('request', (request) => pageRequests.push(request.url()))

  const ask = (text: string): Promise<unknown> =>
    page.evaluate(
      (message) =>
        (
          window as unknown as {
            api: { coach: { chat: (input: unknown) => Promise<unknown> } }
          }
        ).api.coach.chat({ turns: [{ role: 'user', text: message }], language: 'es' }),
      text
    )

  // The coach off: asking does not reach anything, and neither does using the rest of the app.
  expect(await ask('Hola')).toEqual({ ok: false, error: { kind: 'not-enabled' } })
  for (const name of ['Tablero', 'Ajustes', 'Biblioteca', 'Inicio']) {
    await page.getByRole('navigation').getByRole('button', { name }).click()
  }
  expect(recorded()).toEqual([])

  // The coach on, with a provider on this computer, and a conversation plus a session summary.
  await page.evaluate(
    (url) =>
      (
        window as unknown as { api: { settings: { set: (patch: unknown) => Promise<void> } } }
      ).api.settings.set({
        aiProvider: 'ollama',
        aiBaseUrl: url,
        aiConsent: true,
        aiEnabled: true
      }),
    provider.url
  )
  expect(await ask('Quiero mejorar mi sentadilla')).toMatchObject({ ok: true })
  const summary = await page.evaluate(() =>
    (
      window as unknown as {
        api: { coach: { summarize: (input: unknown) => Promise<unknown> } }
      }
    ).api.coach.summarize({
      language: 'es',
      session: {
        skillId: 'squat',
        startedAt: 1_700_000_000_000,
        durationSeconds: 300,
        repCount: 10,
        goodCount: 7,
        needsWorkCount: 2,
        badCount: 1,
        score: 80,
        errors: [{ ruleId: 'depth', count: 3 }]
      }
    })
  )
  expect(summary).toMatchObject({ ok: true })

  // Everything went to the provider and nowhere else, and each body has only what is allowed.
  const sent = recorded()
  expect(sent.length).toBe(2)
  for (const request of sent) expect(request.url.startsWith(provider.origin)).toBe(true)
  for (const body of provider.bodies as Array<Record<string, unknown>>) {
    expect(Object.keys(body).sort()).toEqual(['max_tokens', 'messages', 'model', 'response_format'])
  }
  const wire = JSON.stringify(provider.bodies)
  expect(wire).not.toMatch(/data:[a-z]+\/[a-z0-9.+-]+;base64,/i)
  expect(wire).not.toMatch(/[A-Za-z0-9+/]{300,}/)
  expect(wire).not.toMatch(/landmark|"image|"audio|"video|"frame/i)
  const users = (provider.bodies as Array<{ messages: Array<{ role: string; content: string }> }>)
    .flatMap((body) => body.messages)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
  expect(users[0]).toBe('Quiero mejorar mi sentadilla')
  expect(
    Object.keys(JSON.parse(users[1]?.split(String.fromCharCode(10)).pop() ?? '{}') as object).sort()
  ).toEqual([
    'badCount',
    'durationSeconds',
    'errors',
    'goodCount',
    'needsWorkCount',
    'repCount',
    'score',
    'skillId',
    'startedAt'
  ])

  // The page itself asked for nothing outside the app and the provider's own computer.
  const outside = pageRequests.filter((url) => !/^(file|data|blob|devtools):/.test(url))
  expect(outside).toEqual([])
})
