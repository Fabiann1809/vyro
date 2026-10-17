import { createServer, type Server } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page
} from '@playwright/test'

// There is no camera on the machines that run this: the screens that use it show their
// "no camera" state, which is also worth seeing work.

let userData: string
let app: ElectronApplication | undefined

test.beforeEach(() => {
  // A folder of its own, so the test never touches the real database of the person running it.
  userData = mkdtempSync(join(tmpdir(), 'vyro-e2e-'))
})

test.afterEach(async () => {
  await app?.close()
  app = undefined
  rmSync(userData, { recursive: true, force: true })
})

async function launch(): Promise<Page> {
  app = await electron.launch({
    args: [
      '.',
      `--user-data-dir=${userData}`,
      // The Linux runners cannot set up Chromium's own sandbox; the renderer sandbox stays on.
      ...(process.env['CI'] ? ['--no-sandbox'] : [])
    ]
  })
  return app.firstWindow()
}

const nav = (page: Page, name: string): Locator =>
  page.getByRole('navigation').getByRole('button', { name })

test('opens on the home screen with the three exercises', async () => {
  const page = await launch()

  await expect(page).toHaveTitle('VYRO')
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible()
  for (const exercise of ['Sentadilla', 'Flexión', 'Curl de bíceps']) {
    await expect(page.getByRole('button', { name: exercise })).toBeVisible()
  }
  await expect(page.getByText('Todavía no tienes sesiones')).toBeVisible()
})

test('walks through the main screens', async () => {
  const page = await launch()

  await nav(page, 'Progreso').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Progreso' })).toBeVisible()
  await expect(page.getByText('Todavía no tienes sesiones guardadas')).toBeVisible()

  await nav(page, 'Ajustes').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()

  await nav(page, 'Inicio').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible()
})

test('goes from the home screen to the calibration and back', async () => {
  const page = await launch()

  await page.getByRole('button', { name: 'Sentadilla' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Calibración/ })).toBeVisible()
  // The navigation goes away while the user is in front of the camera.
  await expect(page.getByRole('navigation')).toHaveCount(0)

  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible()
})

test('keeps the page isolated from Node and exposes only the typed bridge', async () => {
  const page = await launch()

  // The renderer's globals are not typed in this project, so they are read through a plain shape.
  const exposed = await page.evaluate(() => {
    const globals = window as unknown as {
      require?: unknown
      process?: unknown
      api: { sessions: { list: unknown }; settings: { get: unknown } }
    }
    return {
      require: typeof globals.require,
      process: typeof globals.process,
      sessions: typeof globals.api.sessions.list,
      settings: typeof globals.api.settings.get
    }
  })

  expect(exposed).toEqual({
    require: 'undefined',
    process: 'undefined',
    sessions: 'function',
    settings: 'function'
  })
})

test('remembers the language after the app is closed and opened again', async () => {
  const first = await launch()
  await nav(first, 'Ajustes').click()
  await first.getByLabel('Idioma').selectOption('en')
  await expect(first.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await app?.close()

  const second = await launch()
  await expect(second.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible()
})

test('the coach answers a question with data, and only the typed bridge reaches it', async () => {
  const page = await launch()

  const run = (): Promise<unknown> =>
    page.evaluate(async () => {
      const api = (
        window as unknown as {
          api: {
            coach: { chat: (input: unknown) => Promise<unknown> }
            settings: { set: (patch: unknown) => Promise<void> }
          }
        }
      ).api
      const question = { turns: [{ role: 'user', text: 'Quiero mejorar' }], language: 'es' }
      const off = await api.coach.chat(question)
      await api.settings.set({ aiEnabled: true })
      const noKey = await api.coach.chat(question)
      const invalid = await api.coach.chat({ turns: [], language: 'es' })
      return { off, noKey, invalid, methods: Object.keys(api.coach) }
    })

  // Off by default; on without a key; and a request that makes no sense. None reaches the network.
  expect(await run()).toEqual({
    off: { ok: false, error: { kind: 'not-enabled' } },
    noKey: { ok: false, error: { kind: 'no-key' } },
    invalid: { ok: false, error: { kind: 'invalid-input' } },
    methods: ['chat']
  })
})

// A stand-in for an AI provider, on this computer: it answers like an OpenAI-compatible server and
// remembers what it was sent, so the whole path from the screen to the network can be followed.
interface FakeProvider {
  url: string
  received: Array<{
    headers: Record<string, string | string[] | undefined>
    body: Record<string, unknown>
  }>
  // The next answers, in order; when they run out it answers with the default reply.
  script: Array<{ status: number; headers?: Record<string, string> }>
  close: () => Promise<void>
}

async function startFakeProvider(reply: string): Promise<FakeProvider> {
  const received: FakeProvider['received'] = []
  const script: FakeProvider['script'] = []
  const server: Server = createServer((request, response) => {
    let raw = ''
    request.on('data', (chunk: Buffer) => (raw += chunk.toString()))
    request.on('end', () => {
      received.push({ headers: request.headers, body: JSON.parse(raw) as Record<string, unknown> })
      const next = script.shift() ?? { status: 200 }
      response.writeHead(next.status, { 'content-type': 'application/json', ...next.headers })
      response.end(
        JSON.stringify(
          next.status === 200
            ? {
                choices: [
                  { message: { content: JSON.stringify({ reply }) }, finish_reason: 'stop' }
                ]
              }
            : { error: { message: 'no' } }
        )
      )
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}/v1`,
    received,
    script,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

test.describe('AI coach screen', () => {
  const REPLY = 'Empieza con diez sentadillas lentas.'
  let provider: FakeProvider

  test.beforeEach(async () => {
    provider = await startFakeProvider(REPLY)
  })

  test.afterEach(async () => {
    await provider.close()
  })

  async function turnOnWithFakeProvider(page: Page): Promise<void> {
    await nav(page, 'Ajustes').click()
    await page.getByLabel('Proveedor').selectOption('ollama')
    await page.getByLabel('Dirección del servicio').fill(provider.url)
    await page.getByLabel('Dirección del servicio').blur()
    await page.getByLabel('Activar el coach con IA').check()
  }

  test('invites to turn it on when it is off, and goes to the settings', async () => {
    const page = await launch()

    await nav(page, 'Coach').click()
    await expect(page.getByRole('heading', { name: 'El coach con IA está apagado' })).toBeVisible()
    await page.getByRole('button', { name: 'Ir a Ajustes' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
  })

  test('holds a conversation, from the screen to the provider and back', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)

    await nav(page, 'Coach').click()
    await page.getByLabel('Tu mensaje').fill('Quiero mejorar mi sentadilla')
    await page.getByLabel('Tu mensaje').press('Enter')

    const log = page.getByRole('log', { name: 'Conversación con el coach' })
    await expect(log.getByText('Quiero mejorar mi sentadilla')).toBeVisible()
    await expect(log.getByText(REPLY)).toBeVisible()
    // The box is empty and ready again.
    await expect(page.getByLabel('Tu mensaje')).toHaveValue('')
    await expect(page.getByLabel('Tu mensaje')).toBeFocused()

    // What reached the provider: the persona, the message, no key, nothing else.
    expect(provider.received).toHaveLength(1)
    const [sent] = provider.received
    expect(sent?.headers['authorization']).toBeUndefined()
    expect(Object.keys(sent?.body ?? {}).sort()).toEqual([
      'max_tokens',
      'messages',
      'model',
      'response_format'
    ])
    const messages = sent?.body['messages'] as Array<{ role: string; content: string }>
    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).toContain('Always answer in Spanish.')
    expect(messages.slice(1)).toEqual([{ role: 'user', content: 'Quiero mejorar mi sentadilla' }])
  })

  test('keeps the whole conversation in what it sends next, and starts over when asked', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Coach').click()

    await page.getByLabel('Tu mensaje').fill('Hola')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText(REPLY)).toBeVisible()
    await page.getByLabel('Tu mensaje').fill('Gracias')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText(REPLY)).toHaveCount(2)

    const second = provider.received[1]?.body['messages'] as Array<{ role: string }>
    expect(second.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user'])

    await page.getByRole('button', { name: 'Nueva conversación' }).click()
    await expect(page.getByText('Cuéntame qué quieres aprender o mejorar.')).toBeVisible()
  })

  test('explains a rate limit with the wait and lets the user try again', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Coach').click()
    provider.script.push({ status: 429, headers: { 'retry-after': '7' } })

    await page.getByLabel('Tu mensaje').fill('Hola')
    await page.getByLabel('Tu mensaje').press('Enter')

    await expect(page.getByRole('alert')).toContainText('Espera 7 s')
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByText(REPLY)).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('says that the provider had a problem, and recovers on retry', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Coach').click()
    provider.script.push({ status: 503 })

    await page.getByLabel('Tu mensaje').fill('Hola')
    await page.getByLabel('Tu mensaje').press('Enter')

    await expect(page.getByRole('alert')).toContainText('El proveedor tuvo un problema')
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByText(REPLY)).toBeVisible()
  })

  test('writes a new line with Shift + Enter instead of sending', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Coach').click()

    await page.getByLabel('Tu mensaje').fill('Primera línea')
    await page.getByLabel('Tu mensaje').press('Shift+Enter')
    await page.getByLabel('Tu mensaje').pressSequentially('Segunda línea')

    expect(provider.received).toHaveLength(0)
    await expect(page.getByLabel('Tu mensaje')).toHaveValue('Primera línea\nSegunda línea')
  })
})

// The system key store is only dependable on the Windows runner: Linux CI has no keyring and a
// macOS runner may have no unlocked keychain. The logic itself is covered by the unit tests.
test.describe('API key', () => {
  test.skip(process.platform !== 'win32', 'Needs the Windows key store')

  const SECRET = 'sk-e2e-secret-1234567890'

  test('is stored encrypted, survives a restart and never comes back to the page', async () => {
    const first = await launch()
    await nav(first, 'Ajustes').click()
    await first.getByLabel('Clave de API').fill(SECRET)
    await first.getByRole('button', { name: 'Guardar clave' }).click()
    await expect(first.getByText('Clave guardada en este equipo')).toBeVisible()
    // The page forgets what was typed once the key has been handed over.
    await expect(first.getByLabel('Clave de API')).toHaveValue('')

    const exposed = await first.evaluate(async () => {
      const ai = (window as unknown as { api: { ai: { keyStatus: () => Promise<unknown> } } }).api
        .ai
      return { methods: Object.keys(ai).sort(), status: await ai.keyStatus() }
    })
    expect(exposed.methods).toEqual(['clearKey', 'keyStatus', 'saveKey'])
    expect(JSON.stringify(exposed.status)).not.toContain(SECRET)

    // On disk, only the encrypted bytes.
    expect(readFileSync(join(userData, 'ai-key.bin')).toString('latin1')).not.toContain(SECRET)
    await app?.close()

    const second = await launch()
    await nav(second, 'Ajustes').click()
    await expect(second.getByText('Clave guardada en este equipo')).toBeVisible()

    await second.getByRole('button', { name: 'Quitar clave' }).click()
    await expect(second.getByText('Aún no has guardado ninguna clave')).toBeVisible()
  })
})
