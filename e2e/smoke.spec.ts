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
    methods: ['chat', 'summarize', 'planPath']
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
  // What the model answers from now on, as the JSON it writes.
  setAnswer: (answer: Record<string, unknown>) => void
  close: () => Promise<void>
}

async function startFakeProvider(reply: string): Promise<FakeProvider> {
  const received: FakeProvider['received'] = []
  const script: FakeProvider['script'] = []
  let answer: Record<string, unknown> = { reply }
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
                choices: [{ message: { content: JSON.stringify(answer) }, finish_reason: 'stop' }]
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
    setAnswer: (next) => {
      answer = next
    },
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

  test('asks for the summary of a session and sends only its numbers', async () => {
    provider.setAnswer({ summary: 'Buena sesión.', tip: 'Baja un poco más.' })
    const page = await launch()
    await turnOnWithFakeProvider(page)

    const session = {
      skillId: 'squat',
      startedAt: 1_700_000_000_000,
      durationSeconds: 600,
      repCount: 12,
      goodCount: 8,
      needsWorkCount: 3,
      badCount: 1,
      score: 79,
      errors: [{ ruleId: 'depth', count: 4 }]
    }
    const ask = (input: unknown): Promise<unknown> =>
      page.evaluate(
        (value) =>
          (
            window as unknown as { api: { coach: { summarize: (i: unknown) => Promise<unknown> } } }
          ).api.coach.summarize(value),
        input
      )

    expect(await ask({ session, language: 'es' })).toEqual({
      ok: true,
      value: { summary: 'Buena sesión.', tip: 'Baja un poco más.' }
    })

    // Exactly the digest reached the provider, as numbers and internal names.
    expect(provider.received).toHaveLength(1)
    const messages = provider.received[0]?.body['messages'] as Array<{
      role: string
      content: string
    }>
    const [, userMessage] = messages
    const [lead, json] = (userMessage?.content ?? '').split('\n')
    expect(lead).toBe('Summarise this training session.')
    expect(JSON.parse(json ?? '')).toEqual(session)

    // A session with anything else in it is refused before it can leave.
    const tampered = {
      ...session,
      landmarks: [{ x: 0.1, y: 0.2 }],
      frame: 'data:image/png;base64,AAAA'
    }
    expect(await ask({ session: tampered, language: 'es' })).toEqual({
      ok: false,
      error: { kind: 'invalid-input' }
    })
    expect(provider.received).toHaveLength(1)
  })

  test('plans a learning path, or says why it cannot', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    const plan = (text: string): Promise<unknown> =>
      page.evaluate(
        (message) =>
          (
            window as unknown as { api: { coach: { planPath: (i: unknown) => Promise<unknown> } } }
          ).api.coach.planPath({
            turns: [{ role: 'user', text: message }],
            language: 'es',
            skills: [{ id: 'squat', name: { es: 'Sentadilla', en: 'Squat' }, ruleIds: ['depth'] }]
          }),
        text
      )

    provider.setAnswer({
      action: 'propose',
      requirement: { channels: ['body'] },
      path: {
        goal: 'Mejorar mi sentadilla',
        steps: [
          {
            title: 'Sentadilla lenta',
            description: 'Baja en tres segundos.',
            kind: 'skill',
            skillId: 'squat',
            criterionSessions: 3,
            criterionScore: 75
          }
        ]
      }
    })
    expect(await plan('Quiero mejorar mi sentadilla')).toMatchObject({
      ok: true,
      value: { kind: 'path', path: { goal: 'Mejorar mi sentadilla' } }
    })

    // The planner is told which skills exist, and nothing else about the person.
    const messages = provider.received[0]?.body['messages'] as Array<{
      role: string
      content: string
    }>
    expect(messages[0]?.content).toContain('- squat: "Squat" / "Sentadilla"')
    expect(messages.slice(1)).toEqual([{ role: 'user', content: 'Quiero mejorar mi sentadilla' }])

    // Something that cannot be measured is declined by the app, not left to the model.
    provider.setAnswer({
      action: 'ask',
      requirement: { channels: [], outOfScope: ['invisible-outcome'] },
      question: '¿Qué tipo?'
    })
    expect(await plan('Quiero aprender a meditar')).toEqual({
      ok: true,
      value: { kind: 'out-of-scope', reasons: ['invisible-outcome', 'no-signal'], measurable: [] }
    })
  })

  test('creates a path with the planner, follows both kinds of step, and keeps it after a restart', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Ruta').click()

    // The planner asks first, then proposes.
    provider.setAnswer({
      action: 'ask',
      requirement: { channels: ['body'] },
      question: '¿Qué nivel tienes?'
    })
    await page.getByLabel('Qué quieres aprender').fill('Quiero mejorar mi sentadilla')
    await page.getByLabel('Qué quieres aprender').press('Enter')
    await expect(page.getByText('¿Qué nivel tienes?')).toBeVisible()

    provider.setAnswer({
      action: 'propose',
      requirement: { channels: ['body'] },
      path: {
        goal: 'Mejorar mi sentadilla',
        steps: [
          {
            title: 'Sentadilla lenta',
            description: 'Baja en tres segundos.',
            kind: 'skill',
            skillId: 'squat',
            criterionSessions: 3,
            criterionScore: 75
          },
          {
            title: 'Descansar un día',
            description: 'Deja que los músculos se recuperen.',
            kind: 'auxiliary',
            skillId: null,
            criterionSessions: null,
            criterionScore: null
          }
        ]
      }
    })
    await page.getByLabel('Qué quieres aprender').fill('Principiante')
    await page.getByLabel('Qué quieres aprender').press('Enter')

    // The proposal, with the two kinds of step told apart in words.
    await expect(
      page.getByRole('heading', { name: 'Esta es la ruta que te propongo' })
    ).toBeVisible()
    await expect(page.getByText('Habilidad medible')).toBeVisible()
    await expect(page.getByText('Auxiliar')).toBeVisible()
    await page.getByRole('button', { name: 'Guardar ruta' }).click()

    // The path being followed: the first step is the next one.
    await expect(page.getByRole('heading', { level: 1, name: 'Mi ruta' })).toBeVisible()
    await expect(page.getByText('Mejorar mi sentadilla')).toBeVisible()
    await expect(page.getByText('Pasos hechos: 0 de 2')).toBeVisible()
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Sentadilla lenta' })
    ).toHaveAttribute('aria-current', 'step')
    await expect(page.getByText('Habilidad: Sentadilla')).toBeVisible()
    await expect(page.getByText('Meta: 3 sesiones con 75 puntos o más')).toBeVisible()

    // The planner was told which skills exist, and nothing else about the person.
    const first = provider.received[0]?.body['messages'] as Array<{ role: string; content: string }>
    expect(first[0]?.content).toContain('- squat: "Squat" / "Sentadilla"')
    expect(first[0]?.content).toContain('- pushup:')
    expect(first.slice(1)).toEqual([{ role: 'user', content: 'Quiero mejorar mi sentadilla' }])

    // An auxiliary step is marked by hand, and can be undone.
    await page.getByRole('button', { name: 'Marcar como hecho' }).click()
    await expect(page.getByText('Pasos hechos: 1 de 2')).toBeVisible()
    await expect(page.getByText(/Hecho el /)).toBeVisible()
    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect(page.getByText('Pasos hechos: 0 de 2')).toBeVisible()
    await page.getByRole('button', { name: 'Marcar como hecho' }).click()

    // It is still there, with its progress, after closing the app and opening it again.
    await app?.close()
    const again = await launch()
    await nav(again, 'Ruta').click()
    await expect(again.getByText('Mejorar mi sentadilla')).toBeVisible()
    await expect(again.getByText('Pasos hechos: 1 de 2')).toBeVisible()

    // A measurable step leads to the calibration of its skill.
    await again.getByRole('button', { name: 'Practicar' }).click()
    await expect(
      again.getByRole('heading', { level: 1, name: /Calibración · Sentadilla/ })
    ).toBeVisible()
  })

  test('explains why a path cannot be made, and lets the person start again', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Ruta').click()
    provider.setAnswer({
      action: 'ask',
      requirement: { channels: [], outOfScope: ['invisible-outcome'] },
      question: '¿Qué tipo de meditación?'
    })

    await page.getByLabel('Qué quieres aprender').fill('Quiero aprender a meditar')
    await page.getByLabel('Qué quieres aprender').press('Enter')

    await expect(page.getByRole('heading', { name: 'VYRO no puede entrenar eso' })).toBeVisible()
    await expect(page.getByText('El resultado no se puede ver ni oír')).toBeVisible()
    // The app decided, not the model: the question it asked was never shown.
    await expect(page.getByText('¿Qué tipo de meditación?')).toHaveCount(0)

    await page.getByRole('button', { name: 'Empezar de nuevo' }).click()
    await expect(page.getByLabel('Qué quieres aprender')).toBeVisible()
  })

  test('invites to turn the AI on before making a path', async () => {
    const page = await launch()

    await nav(page, 'Ruta').click()

    await expect(page.getByText('Para crear una ruta, activa el coach con IA')).toBeVisible()
    await page.getByRole('button', { name: 'Ir a Ajustes' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
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
