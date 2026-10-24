import { createServer, type Server } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
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

async function launch(
  options: { before?: string[]; env?: Record<string, string> } = {}
): Promise<Page> {
  app = await electron.launch({
    env: { ...process.env, ...options.env } as Record<string, string>,
    args: [
      ...(options.before ?? []),
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

test('opens on the chat and offers the exercises in the library', async () => {
  const page = await launch()

  await expect(page).toHaveTitle('VYRO')
  await expect(nav(page, 'Inicio')).toHaveAttribute('aria-current', 'page')

  await nav(page, 'Biblioteca').click()
  await expect(nav(page, 'Biblioteca')).toHaveAttribute('aria-current', 'page')
  for (const exercise of ['Sentadilla', 'Flexión', 'Curl de bíceps']) {
    await expect(page.getByRole('button', { name: exercise })).toBeVisible()
  }
})

test('walks through the main screens', async () => {
  const page = await launch()

  await nav(page, 'Tablero').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Tablero' })).toBeVisible()
  await expect(page.getByText('Todavía no tienes sesiones guardadas')).toBeVisible()

  await nav(page, 'Ajustes').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()

  await nav(page, 'Inicio').click()
  await expect(nav(page, 'Inicio')).toHaveAttribute('aria-current', 'page')
})

test('goes from the library to the calibration and back', async () => {
  const page = await launch()

  await nav(page, 'Biblioteca').click()
  await page.getByRole('button', { name: 'Sentadilla' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Calibración/ })).toBeVisible()
  // The navigation goes away while the user is in front of the camera.
  await expect(page.getByRole('navigation')).toHaveCount(0)

  // The card grew into the calibration and the layer it drew has gone again.
  await expect(page.locator('div.fixed.z-50')).toHaveCount(0)

  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(nav(page, 'Biblioteca')).toHaveAttribute('aria-current', 'page')
})

test('moves nothing when less motion is asked for', async () => {
  const page = await launch()
  // Whatever the computer says about motion, this test starts from "no preference".
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const animationOfCoach = (): Promise<string> =>
    page.evaluate(() => {
      const avatar = document.querySelector('[style*="vy-breath"]')
      return avatar ? getComputedStyle(avatar).animationName : 'missing'
    })

  // The coach breathes while nothing is asked.
  await expect(page.locator('[style*="vy-breath"]').first()).toBeAttached()
  expect(await animationOfCoach()).toContain('vy-breath')

  await nav(page, 'Ajustes').click()
  await page.getByLabel('Reducir el movimiento').check()
  await nav(page, 'Inicio').click()
  await expect(page.locator('[style*="vy-breath"]').first()).toBeAttached()

  expect(await animationOfCoach()).toBe('none')

  // And a card does not grow: the screen it leads to is there at once.
  await nav(page, 'Biblioteca').click()
  await page.getByRole('button', { name: 'Empezar Sentadilla' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Calibración/ })).toBeVisible({
    timeout: 1500
  })
})

test('narrows the library down by channel and by category', async () => {
  const page = await launch()
  await nav(page, 'Biblioteca').click()
  const channels = page.getByRole('group', { name: 'Filtrar por canal' })
  const categories = page.getByRole('group', { name: 'Filtrar por categoría' })

  await channels.getByRole('button', { name: 'Audio' }).click()
  await expect(page.getByRole('button', { name: 'Afinar una cuerda' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sentadilla' })).toHaveCount(0)

  // The two choices add up: nothing that listens is an exercise.
  await categories.getByRole('button', { name: 'Fitness' }).click()
  await expect(page.getByText('Ninguna habilidad con ese filtro todavía.')).toBeVisible()

  await channels.getByRole('button', { name: 'Todos los canales' }).click()
  await expect(page.getByRole('button', { name: 'Sentadilla' })).toBeVisible()
})

// Saves sessions through the bridge, a few days ago each, so that the dashboard has something to show.
async function saveSessions(
  page: Page,
  sessions: Array<{
    daysAgo: number
    skillId: string
    score: number
    quality: string[]
    failed: string[]
  }>
): Promise<void> {
  await page.evaluate(async (items) => {
    const api = (
      window as unknown as { api: { sessions: { save: (session: unknown) => Promise<number> } } }
    ).api
    for (const item of items) {
      const startedAt = new Date()
      startedAt.setDate(startedAt.getDate() - item.daysAgo)
      startedAt.setHours(18, 0, 0, 0)
      await api.sessions.save({
        skillId: item.skillId,
        startedAt: startedAt.getTime(),
        durationMs: 60_000,
        score: item.score,
        reps: item.quality.map((quality, index) => ({
          index: index + 1,
          quality,
          durationMs: 2000,
          failedRuleIds: quality === 'good' ? [] : item.failed
        }))
      })
    }
  }, sessions)
}

test('invites to a first session when the dashboard has nothing to show', async () => {
  const page = await launch()

  await nav(page, 'Tablero').click()

  await expect(page.getByText('Todavía no tienes sesiones guardadas')).toBeVisible()
  await page.getByRole('button', { name: 'Hacer mi primera sesión' }).click()
  await expect(nav(page, 'Biblioteca')).toHaveAttribute('aria-current', 'page')
})

test('shows the streak, the score and what fails most, from the saved sessions', async () => {
  const page = await launch()
  const squat = { skillId: 'squat', failed: ['depth'] }
  await saveSessions(page, [
    { ...squat, daysAgo: 12, score: 55, quality: ['good', 'bad', 'bad', 'good'] },
    { ...squat, daysAgo: 2, score: 70, quality: ['good', 'good', 'bad', 'good'] },
    { ...squat, daysAgo: 1, score: 80, quality: ['good', 'good', 'good', 'good', 'bad', 'bad'] },
    { ...squat, daysAgo: 0, score: 90, quality: ['good', 'good', 'good', 'good', 'good', 'good'] },
    {
      skillId: 'string_tuning',
      failed: ['too_flat'],
      daysAgo: 0,
      score: 60,
      quality: ['good', 'bad']
    }
  ])

  await nav(page, 'Tablero').click()

  await expect(page.getByText('días seguidos', { exact: true })).toBeVisible()
  await expect(page.getByText('Subiste 5 puntos en 5 sesiones')).toBeVisible()
  await expect(page.getByText('Mejor marca · 90')).toBeVisible()
  await expect(page.getByText('Vas mejorando, sesión a sesión.')).toBeVisible()
  // What fails most is named, with the number of times.
  await expect(page.getByText('Lo que más se repite')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Historial de sesiones' })).toBeVisible()
  await expect(page.getByText('5 sesiones', { exact: true })).toBeVisible()
  await expect(page.getByText('Cada vez fallas menos').first()).toBeVisible()

  // The skill filter narrows everything to one skill.
  const filter = page.getByRole('group', { name: 'Ver por habilidad' })
  await filter.getByRole('button', { name: 'Afinar una cuerda' }).click()
  await expect(page.getByText('1 sesión', { exact: true })).toBeVisible()
  await expect(page.getByText('Tu puntuación: 60')).toBeVisible()
})

test('explains how it works from the side bar and leads back to the chat', async () => {
  const page = await launch()

  await nav(page, 'Cómo funciona').click()

  await expect(page.getByRole('heading', { level: 1, name: 'Cómo funciona VYRO' })).toBeVisible()
  for (const step of [
    'Dime qué quieres aprender',
    'Armo tu ruta',
    'Te miro y te escucho',
    'Ves cómo mejoras'
  ]) {
    await expect(page.getByRole('heading', { name: step })).toBeVisible()
  }
  await expect(page.getByRole('heading', { name: 'Privado' })).toBeVisible()

  await page.getByRole('button', { name: 'Hablar con el coach' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: '¿Qué quieres aprender?' })
  ).toBeVisible()
  await expect(page.getByLabel('Tu mensaje')).toBeFocused()
})

test('a skill of the hands is calibrated with the hands, not the body', async () => {
  const page = await launch()

  await nav(page, 'Biblioteca').click()
  await page.getByRole('button', { name: 'Mano al piano' }).click()

  await expect(
    page.getByRole('heading', { level: 1, name: /Calibración · Mano al piano/ })
  ).toBeVisible()
  await expect(page.getByText('Mano completa')).toBeVisible()
  await expect(page.getByText('Muestra tu mano a la cámara')).toBeVisible()
  await expect(page.getByText('Cuerpo completo')).toHaveCount(0)
})

test('a skill played with the hand and the sound is calibrated with both', async () => {
  const page = await launch()

  await nav(page, 'Biblioteca').click()
  await page.getByRole('button', { name: 'Nota Do al piano' }).click()

  await expect(
    page.getByRole('heading', { level: 1, name: /Calibración · Nota Do al piano/ })
  ).toBeVisible()
  for (const check of ['Mano completa', 'Ruido de la sala']) {
    await expect(page.getByText(check, { exact: true })).toBeVisible()
  }
})

test('groups the checks of the calibration by what is watched, and leaves with Escape', async () => {
  const page = await launch()
  await nav(page, 'Biblioteca').click()
  await page.getByRole('button', { name: 'Empezar Nota Do al piano' }).click()

  const groups = page.getByRole('group')
  await expect(
    groups.filter({ hasText: 'Mano completa' }).getByText('Manos', { exact: true })
  ).toBeVisible()
  await expect(
    groups.filter({ hasText: 'Ruido de la sala' }).getByText('Audio', { exact: true })
  ).toBeVisible()

  // The guide of the skill is there, folded, and opens to what the app does not check.
  await page.getByText('Antes de empezar', { exact: true }).click()
  await expect(page.getByText('Que el hombro y el antebrazo estén relajados')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(nav(page, 'Biblioteca')).toHaveAttribute('aria-current', 'page')
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

test('moves between the sections of the settings, one at a time', async () => {
  const page = await launch()
  await nav(page, 'Ajustes').click()

  // It opens on the general part; the others wait behind their tabs.
  await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Idioma')).toBeVisible()
  await expect(page.getByLabel('Voz activada')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Voz' }).click()
  await expect(page.getByLabel('Voz activada')).toBeChecked()
  await expect(page.getByLabel('Idioma')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Acerca de' }).click()
  await expect(page.getByText(/no sustituye a un profesional de la salud/)).toBeVisible()
})

test('opens the settings on the coach when something there is what is needed', async () => {
  const page = await launch()

  await page.getByLabel('Tu mensaje').fill('Quiero mejorar mi sentadilla')
  await page.getByLabel('Tu mensaje').press('Enter')
  await page.getByRole('button', { name: 'Activar IA' }).click()

  await expect(page.getByRole('tab', { name: 'Coach con IA' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByLabel('Activar el coach con IA')).toBeVisible()
  await expect(
    page.getByRole('progressbar', { name: 'Uso de hoy frente al límite diario' })
  ).toBeVisible()
})

test('remembers the language after the app is closed and opened again', async () => {
  const first = await launch()
  await nav(first, 'Ajustes').click()
  await first.getByLabel('Idioma').selectOption('en')
  await expect(first.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await app?.close()

  const second = await launch()
  await expect(nav(second, 'Home')).toHaveAttribute('aria-current', 'page')
})

test('turns the hand control off in the settings and remembers it after a restart', async () => {
  const first = await launch()
  await nav(first, 'Ajustes').click()
  await first.getByRole('tab', { name: 'Cámara' }).click()
  const control = first.getByLabel('Terminar señalando con el dedo')
  await expect(control).toBeChecked()
  await control.uncheck()
  await app?.close()

  const second = await launch()
  await nav(second, 'Ajustes').click()
  await second.getByRole('tab', { name: 'Cámara' }).click()
  await expect(second.getByLabel('Terminar señalando con el dedo')).not.toBeChecked()
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
      const noConsent = await api.coach.chat(question)
      await api.settings.set({ aiConsent: true })
      const noKey = await api.coach.chat(question)
      const invalid = await api.coach.chat({ turns: [], language: 'es' })
      return { off, noConsent, noKey, invalid, methods: Object.keys(api.coach) }
    })

  // Off by default; on without a key; and a request that makes no sense. None reaches the network.
  expect(await run()).toEqual({
    off: { ok: false, error: { kind: 'not-enabled' } },
    noConsent: { ok: false, error: { kind: 'no-consent' } },
    noKey: { ok: false, error: { kind: 'no-key' } },
    invalid: { ok: false, error: { kind: 'invalid-input' } },
    methods: ['chat', 'summarize', 'planPath', 'reviewPath', 'generateSkill']
  })
})

test('shows a skill that was saved in the database after the app was built, and only the approved ones', async () => {
  // Opening the app once creates the database and brings it to the current version.
  await (await launch()).title()
  await app?.close()

  // Skills saved later, as the generator will save them: one approved, one draft, one damaged.
  const squat = JSON.parse(readFileSync('src/renderer/skills/squat.json', 'utf-8')) as object
  const db = new DatabaseSync(join(userData, 'vyro.db'))
  const insert = db.prepare(
    'INSERT INTO custom_skills (id, config_json, status, created_at) VALUES (?, ?, ?, ?)'
  )
  const named = (id: string, name: string): string =>
    JSON.stringify({ ...squat, id, name: { es: name, en: name } })
  insert.run('custom_yoga', named('custom_yoga', 'Yoga suave'), 'approved', 1)
  insert.run('custom_draft', named('custom_draft', 'Aún sin aprobar'), 'draft', 2)
  insert.run('custom_broken', '{esto no es json', 'approved', 3)
  db.close()

  const page = await launch()
  await nav(page, 'Biblioteca').click()

  await expect(page.getByRole('button', { name: 'Yoga suave' })).toBeVisible()
  // The ones that come with the app are still there, and the others are not offered.
  await expect(page.getByRole('button', { name: 'Sentadilla' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aún sin aprobar' })).toHaveCount(0)

  // It can be practised like any other.
  await page.getByRole('button', { name: 'Yoga suave' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: /Calibración · Yoga suave/ })
  ).toBeVisible()
})

test('suggests the posture before a guitar lesson, without blocking it', async () => {
  await (await launch()).title()
  await app?.close()
  // A lesson made before the rule about the body existed: it keeps working.
  const squat = JSON.parse(readFileSync('src/renderer/skills/squat.json', 'utf-8')) as object
  const db = new DatabaseSync(join(userData, 'vyro.db'))
  db.prepare(
    'INSERT INTO custom_skills (id, config_json, status, created_at) VALUES (?, ?, ?, ?)'
  ).run(
    'custom_guitar_lesson',
    JSON.stringify({
      ...squat,
      id: 'custom_guitar_lesson',
      name: { es: 'Cuerda al aire de guitarra', en: 'Open guitar string' }
    }),
    'approved',
    1
  )
  db.close()
  const page = await launch()
  await nav(page, 'Biblioteca').click()

  await page.getByRole('button', { name: 'Cuerda al aire de guitarra' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: /Calibración · Cuerda al aire de guitarra/ })
  ).toBeVisible()
  await expect(
    page.getByText('Te recomendamos hacer primero la postura con la guitarra')
  ).toBeVisible()

  await page.getByRole('button', { name: 'Hacer la postura primero' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: /Calibración · Postura con guitarra/ })
  ).toBeVisible()
  await expect(page.getByText('Te recomendamos hacer primero la postura')).toHaveCount(0)
})

test('goes back to the skills of the app when all the data is deleted', async () => {
  await (await launch()).title()
  await app?.close()
  const squat = JSON.parse(readFileSync('src/renderer/skills/squat.json', 'utf-8')) as object
  const db = new DatabaseSync(join(userData, 'vyro.db'))
  db.prepare(
    'INSERT INTO custom_skills (id, config_json, status, created_at) VALUES (?, ?, ?, ?)'
  ).run(
    'custom_yoga',
    JSON.stringify({ ...squat, id: 'custom_yoga', name: { es: 'Yoga suave', en: 'Gentle yoga' } }),
    'approved',
    1
  )
  db.close()
  const page = await launch()
  await nav(page, 'Biblioteca').click()
  await expect(page.getByRole('button', { name: 'Yoga suave' })).toBeVisible()

  await nav(page, 'Ajustes').click()
  await page.getByRole('tab', { name: 'Privacidad y datos' }).click()
  await page.getByRole('button', { name: 'Borrar todos los datos' }).click()
  await page.getByRole('button', { name: 'Sí, borrar todo' }).click()
  await expect(page.getByText('Datos borrados.')).toBeVisible()
  await nav(page, 'Biblioteca').click()

  await expect(page.getByRole('button', { name: 'Yoga suave' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sentadilla' })).toBeVisible()
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

  // The coach asks the question REPLY: what the first message of the home screen is answered with.
  function askReply(): void {
    provider.setAnswer({
      action: 'ask',
      requirement: { channels: ['body'] },
      question: REPLY
    })
  }

  async function turnOnWithFakeProvider(page: Page): Promise<void> {
    await nav(page, 'Ajustes').click()
    await page.getByRole('tab', { name: 'Coach con IA' }).click()
    await page.getByLabel('Proveedor').selectOption('ollama')
    await page.getByLabel('Dirección del servicio').fill(provider.url)
    await page.getByLabel('Dirección del servicio').blur()
    await page.getByLabel('Activar el coach con IA').click()
    await page.getByRole('button', { name: 'Acepto y activar' }).click()
  }

  test('asks for consent the first time the AI is turned on, and only then turns it on', async () => {
    const page = await launch()
    await nav(page, 'Ajustes').click()
    await page.getByRole('tab', { name: 'Coach con IA' }).click()
    await page.getByLabel('Proveedor').selectOption('ollama')

    await page.getByLabel('Activar el coach con IA').click()
    await expect(
      page.getByRole('alertdialog', { name: 'Antes de activar el coach con IA' })
    ).toBeVisible()
    await expect(page.getByText(/Nunca video, imágenes, puntos del cuerpo ni audio/)).toBeVisible()
    await expect(page.getByText(/no son consejo médico/)).toBeVisible()
    await expect(
      page.getByText(/pueden usar lo que reciben para mejorar sus productos/)
    ).toBeVisible()

    // Cancelling leaves it off.
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByLabel('Activar el coach con IA')).not.toBeChecked()

    await page.getByLabel('Activar el coach con IA').click()
    await page.getByRole('button', { name: 'Acepto y activar' }).click()
    await expect(page.getByLabel('Activar el coach con IA')).toBeChecked()

    // It is not asked again.
    await page.getByLabel('Activar el coach con IA').uncheck()
    await page.getByLabel('Activar el coach con IA').click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByLabel('Activar el coach con IA')).toBeChecked()
  })

  test('invites to turn it on when it is off, and goes to the settings', async () => {
    const page = await launch()

    await expect(
      page.getByRole('heading', { level: 1, name: '¿Qué quieres aprender?' })
    ).toBeVisible()
    await page.getByLabel('Tu mensaje').fill('Quiero mejorar mi sentadilla')
    await page.getByLabel('Tu mensaje').press('Enter')

    await expect(page.getByRole('heading', { name: /Aún no tengo cerebro de IA/ })).toBeVisible()
    await page.getByRole('button', { name: 'Activar IA' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
  })

  test('opens a skill from a suggestion when the coach is off', async () => {
    const page = await launch()

    await page.getByRole('button', { name: 'Mejorar mi sentadilla' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: /Calibración · Sentadilla/ })
    ).toBeVisible()
  })

  test('fills the box with a suggestion when the coach is on', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)

    await nav(page, 'Inicio').click()
    await page.getByRole('button', { name: 'Mejorar mi sentadilla' }).click()

    await expect(page.getByLabel('Tu mensaje')).toHaveValue('Quiero mejorar mi sentadilla')
    expect(provider.received).toHaveLength(0)
  })

  test('holds a conversation, from the screen to the provider and back', async () => {
    askReply()
    const page = await launch()
    await turnOnWithFakeProvider(page)

    await nav(page, 'Inicio').click()
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
    expect(messages.slice(1)).toEqual([{ role: 'user', content: 'Quiero mejorar mi sentadilla' }])
  })

  const SQUAT_PATH = {
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
          criterionSessions: 2,
          criterionScore: 75
        },
        {
          title: 'Descanso activo',
          description: 'Camina diez minutos.',
          kind: 'auxiliary',
          skillId: null,
          criterionSessions: null,
          criterionScore: null,
          guide: { tips: ['Hazlo despacio y sin dolor.', 'Respira con calma.'], minutes: 5 }
        }
      ]
    }
  }

  test('shows a proposed path as a card, keeps it when asked and starts its first step', async () => {
    provider.setAnswer(SQUAT_PATH)
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()

    await page.getByLabel('Tu mensaje').fill('Quiero mejorar mi sentadilla')
    await page.getByLabel('Tu mensaje').press('Enter')

    const card = page.getByRole('heading', { name: 'Mejorar mi sentadilla' })
    await expect(card).toBeVisible()
    await expect(page.getByText('Sentadilla lenta').first()).toBeVisible()
    await expect(page.getByText('Descanso activo')).toBeVisible()
    await expect(page.getByText('Auxiliar')).toBeVisible()
    await expect(page.getByText('2 pasos')).toBeVisible()

    // A path is not kept until the person says so.
    await expect(page.getByText('Ruta guardada')).toHaveCount(0)
    await nav(page, 'Mi ruta').click()
    await expect(page.getByText(/Todavía no sigues ninguna ruta/)).toBeVisible()
    await nav(page, 'Inicio').click()

    await page.getByRole('button', { name: 'Empezar ahora' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: /Calibración · Sentadilla/ })
    ).toBeVisible()

    // Leaving the calibration comes back to the chat, where the path is now kept.
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByText('Ruta guardada')).toBeVisible()
    await nav(page, 'Mi ruta').click()
    await expect(page.getByText('Sentadilla lenta').first()).toBeVisible()
  })

  test('keeps a proposed path and opens it, and goes on chatting afterwards', async () => {
    provider.setAnswer(SQUAT_PATH)
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()
    await page.getByLabel('Tu mensaje').fill('Quiero mejorar mi sentadilla')
    await page.getByLabel('Tu mensaje').press('Enter')

    await page.getByRole('button', { name: 'Ver ruta completa' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Mi ruta' })).toBeVisible()
    await expect(page.getByText('Sentadilla lenta').first()).toBeVisible()

    // Back in the chat the talk is an ordinary one: the answer is not a path any more.
    provider.setAnswer({ reply: REPLY })
    await nav(page, 'Inicio').click()
    await page.getByLabel('Tu mensaje').fill('¿Y si me duele la rodilla?')
    await page.getByLabel('Tu mensaje').press('Enter')

    await expect(page.getByRole('log').getByText(REPLY)).toBeVisible()
    const sent = provider.received.at(-1)?.body['messages'] as Array<{
      role: string
      content: string
    }>
    expect(sent[0]?.content).toContain('Always answer in Spanish.')
    expect(sent.slice(1)).toEqual([{ role: 'user', content: '¿Y si me duele la rodilla?' }])
  })

  test('takes the adjust button as a chance to change what was proposed', async () => {
    provider.setAnswer(SQUAT_PATH)
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()
    await page.getByLabel('Tu mensaje').fill('Quiero mejorar mi sentadilla')
    await page.getByLabel('Tu mensaje').press('Enter')

    await page.getByRole('button', { name: 'Ajustar' }).click()
    await expect(page.getByRole('button', { name: 'Empezar ahora' })).toHaveCount(0)
    await expect(page.getByLabel('Tu mensaje')).toBeFocused()

    await page.getByLabel('Tu mensaje').fill('Más corta, por favor')
    await page.getByLabel('Tu mensaje').press('Enter')
    await expect(page.getByRole('button', { name: 'Empezar ahora' })).toBeVisible()

    // The planner was told about both things the person asked.
    const sent = provider.received.at(-1)?.body['messages'] as Array<{ role: string }>
    expect(sent.map((message) => message.role)).toEqual(['system', 'user', 'user'])
  })

  test('explains on a card why it cannot make a path, and starts over', async () => {
    provider.setAnswer({
      action: 'ask',
      requirement: { channels: [], outOfScope: ['invisible-outcome'] },
      question: '¿Qué tipo de meditación?'
    })
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()

    await page.getByLabel('Tu mensaje').fill('Quiero aprender a meditar')
    await page.getByLabel('Tu mensaje').press('Enter')

    await expect(page.getByRole('heading', { name: 'VYRO no puede entrenar eso' })).toBeVisible()
    await expect(page.getByText('El resultado no se puede ver ni oír')).toBeVisible()
    await page.getByRole('button', { name: 'Probar con otra cosa' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: '¿Qué quieres aprender?' })
    ).toBeVisible()
  })

  test('offers to make a skill when none trains what was asked, with the words already written', async () => {
    provider.setAnswer({
      action: 'no-matching-skill',
      requirement: { channels: ['body'] }
    })
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()

    await page.getByLabel('Tu mensaje').fill('Quiero aprender a caminar')
    await page.getByLabel('Tu mensaje').press('Enter')

    await expect(
      page.getByRole('heading', { name: 'Aún no tengo una habilidad para eso' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Crear esta habilidad con la IA' }).click()

    await expect(page.getByRole('heading', { level: 1, name: /habilidad/i })).toBeVisible()
    await expect(page.getByRole('textbox')).toHaveValue('Quiero aprender a caminar')
  })

  test('counts what it uses, and at the daily limit asks nothing of the provider', async () => {
    askReply()
    const page = await launch()
    await turnOnWithFakeProvider(page)
    const limit = page.getByLabel('Límite diario de uso (tokens)')
    await limit.fill('10000')
    await limit.blur()
    await nav(page, 'Inicio').click()
    await page.getByLabel('Tu mensaje').fill('Hola')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText(REPLY)).toBeVisible()
    expect(provider.received).toHaveLength(1)
    await app?.close()

    // The day's use was kept as a number; the rest of the day is used up.
    const today = new Date()
    const day = [today.getFullYear(), today.getMonth() + 1, today.getDate()]
      .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
      .join('-')
    const db = new DatabaseSync(join(userData, 'vyro.db'))
    const used = db.prepare('SELECT tokens FROM ai_usage WHERE day = ?').get(day) as
      { tokens: number } | undefined
    expect(used?.tokens).toBeGreaterThan(0)
    db.prepare('UPDATE ai_usage SET tokens = 10000 WHERE day = ?').run(day)
    db.close()

    const again = await launch()
    await nav(again, 'Inicio').click()
    await again.getByLabel('Tu mensaje').fill('Otra pregunta')
    await again.getByRole('button', { name: 'Enviar' }).click()

    await expect(again.getByRole('alert')).toContainText('límite diario')
    expect(provider.received).toHaveLength(1)
  })

  test('goes through chat, path and a generated skill with no network but the fake provider', async () => {
    askReply()
    const netLog = join(userData, 'net.jsonl')
    const page = await launch({
      // Every address but this computer fails to resolve, for the page; the watcher notes what Node asks.
      before: [
        '-r',
        resolve('e2e/netLog.cjs'),
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'
      ],
      env: { VYRO_NET_LOG: netLog }
    })
    await turnOnWithFakeProvider(page)

    // Chat.
    await nav(page, 'Inicio').click()
    await page.getByLabel('Tu mensaje').fill('Quiero mejorar mi sentadilla')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText(REPLY)).toBeVisible()

    // Path: it asks, then proposes, and the person keeps it.
    await page.getByRole('button', { name: 'Nueva conversación' }).click()
    provider.setAnswer({
      action: 'ask',
      requirement: { channels: ['body'] },
      question: '¿Qué nivel tienes?'
    })
    await page.getByLabel('Tu mensaje').fill('Quiero mejorar mi sentadilla')
    await page.getByLabel('Tu mensaje').press('Enter')
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
            criterionSessions: 2,
            criterionScore: 75
          }
        ]
      }
    })
    await page.getByLabel('Tu mensaje').fill('Principiante')
    await page.getByLabel('Tu mensaje').press('Enter')
    await page.getByRole('button', { name: 'Ver ruta completa' }).click()
    await expect(page.getByText('Sentadilla lenta').first()).toBeVisible()

    // A skill made by the AI, approved and offered in the library.
    const squat = JSON.parse(readFileSync('src/renderer/skills/squat.json', 'utf-8')) as object
    const yoga = { ...squat, id: 'custom_yoga', name: { es: 'Yoga suave', en: 'Gentle yoga' } }
    provider.setAnswer({ requirement: { channels: ['body'] }, skill: JSON.stringify(yoga) })
    await nav(page, 'Biblioteca').click()
    await page.getByRole('button', { name: 'Crear una habilidad con el coach' }).click()
    await page.getByLabel('Qué habilidad quieres crear').fill('Quiero aprender yoga suave')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await page.getByRole('button', { name: 'Aprobar y probar' }).click()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('button', { name: 'Yoga suave' })).toBeVisible()

    // Nothing was asked of any address but the fake provider.
    const requests = readFileSync(netLog, 'utf-8')
      .split(String.fromCharCode(10))
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { via: string; url: string })
      .filter((entry) => entry.via !== 'loaded')
    expect(requests.length).toBeGreaterThanOrEqual(4)
    for (const request of requests) expect(request.url.startsWith(provider.url)).toBe(true)
  })

  test('keeps the whole conversation in what it sends next, and starts over when asked', async () => {
    askReply()
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()

    await page.getByLabel('Tu mensaje').fill('Hola')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText(REPLY)).toBeVisible()
    await page.getByLabel('Tu mensaje').fill('Gracias')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText(REPLY)).toHaveCount(2)

    const second = provider.received[1]?.body['messages'] as Array<{ role: string }>
    expect(second.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user'])

    await page.getByRole('button', { name: 'Nueva conversación' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: '¿Qué quieres aprender?' })
    ).toBeVisible()
  })

  test('explains a rate limit with the wait and lets the user try again', async () => {
    askReply()
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()
    provider.script.push({ status: 429, headers: { 'retry-after': '7' } })

    await page.getByLabel('Tu mensaje').fill('Hola')
    await page.getByLabel('Tu mensaje').press('Enter')

    await expect(page.getByRole('alert')).toContainText('Espera 7 s')
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByText(REPLY)).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('says that the provider had a problem, and recovers on retry', async () => {
    askReply()
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()
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

  test('creates a path, and its steps advance, unlock and complete as sessions are saved', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()

    // The planner asks first, then proposes.
    provider.setAnswer({
      action: 'ask',
      requirement: { channels: ['body'] },
      question: '¿Qué nivel tienes?'
    })
    await page.getByLabel('Tu mensaje').fill('Quiero mejorar mi sentadilla')
    await page.getByLabel('Tu mensaje').press('Enter')
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
            criterionSessions: 2,
            criterionScore: 75
          },
          {
            title: 'Descansar un día',
            description: 'Deja que los músculos se recuperen.',
            kind: 'auxiliary',
            skillId: null,
            criterionSessions: null,
            criterionScore: null,
            guide: {
              tips: ['Hazlo despacio y sin dolor.', 'Respira con calma.'],
              minutes: 5,
              diagrams: [
                { kind: 'chord', name: 'G' },
                { kind: 'keys', notes: ['C', 'E', 'G'] }
              ]
            }
          },
          {
            title: 'Flexiones controladas',
            description: 'Baja con control.',
            kind: 'skill',
            skillId: 'pushup',
            criterionSessions: 1,
            criterionScore: 70
          }
        ]
      }
    })
    await page.getByLabel('Tu mensaje').fill('Principiante')
    await page.getByLabel('Tu mensaje').press('Enter')

    // The proposal, with the two kinds of step told apart in words.
    await expect(page.getByRole('heading', { name: 'Mejorar mi sentadilla' })).toBeVisible()
    await expect(page.getByText('Auxiliar')).toBeVisible()
    await page.getByRole('button', { name: 'Ver ruta completa' }).click()

    // The planner was told which skills exist, and nothing else about the person.
    const first = provider.received[0]?.body['messages'] as Array<{ role: string; content: string }>
    expect(first[0]?.content).toContain('- squat: "Squat" / "Sentadilla"')
    expect(first.slice(1)).toEqual([{ role: 'user', content: 'Quiero mejorar mi sentadilla' }])

    // Saves a finished session as the training would, and looks at the path again.
    const train = (skillId: string, score: number, secondsFromNow: number): Promise<unknown> =>
      page.evaluate(
        ([skill, points, offset]) =>
          (
            window as unknown as {
              api: { sessions: { save: (session: unknown) => Promise<number> } }
            }
          ).api.sessions.save({
            skillId: skill,
            startedAt: Date.now() + Number(offset) * 1000,
            durationMs: 60_000,
            score: points,
            reps: [{ index: 1, quality: 'good', durationMs: 2000, failedRuleIds: [] }]
          }),
        [skillId, score, secondsFromNow] as const
      )
    const reopen = async (): Promise<void> => {
      await nav(page, 'Inicio').click()
      await nav(page, 'Mi ruta').click()
    }
    const card = (title: string): ReturnType<Page['getByRole']> =>
      page.getByRole('listitem').filter({ hasText: title })

    // At the start: the first step is the next one, the rest are locked.
    await expect(page.getByRole('heading', { level: 1, name: 'Mi ruta' })).toBeVisible()
    await expect(page.getByText('Pasos hechos: 0 de 3')).toBeVisible()
    await expect(card('Sentadilla lenta')).toHaveAttribute('aria-current', 'step')
    // The skill brings its own guide, with what the app does not check.
    await expect(card('Sentadilla lenta')).toContainText('Pies a la anchura de los hombros')
    await expect(card('Sentadilla lenta')).toContainText('Lo que la app no mide')
    await expect(
      card('Sentadilla lenta').getByRole('img', { name: /Abajo: rodillas a unos 90°/ })
    ).toBeVisible()
    await expect(card('Sentadilla lenta')).toContainText('Aún no has practicado esta habilidad')
    await expect(card('Descansar un día')).toContainText(
      'Se desbloquea al completar el paso anterior'
    )
    await expect(card('Descansar un día').getByRole('button')).toHaveCount(0)

    // One good session counts; one that does not reach the score does not.
    await train('squat', 80, 1)
    await train('squat', 60, 2)
    await reopen()
    await expect(card('Sentadilla lenta')).toContainText('Sesiones que cuentan: 1 de 2')
    await expect(card('Sentadilla lenta')).toContainText('2 intentos')
    // A session of another skill, for a locked step, counts for nothing.
    await train('pushup', 95, 3)
    await reopen()
    await expect(card('Flexiones controladas')).toContainText('Se desbloquea')

    // The second good session completes the step and unlocks the next one.
    await train('squat', 90, 4)
    await reopen()
    await expect(page.getByText('Pasos hechos: 1 de 3')).toBeVisible()
    await expect(card('Descansar un día')).toHaveAttribute('aria-current', 'step')
    // The step that cannot be measured says how to do it: open when it is next, with the notice.
    await expect(card('Descansar un día').getByText('Hazlo despacio y sin dolor.')).toBeVisible()
    await expect(card('Descansar un día')).toContainText('unos 5 min')
    await expect(
      card('Descansar un día').getByRole('img', {
        name: 'Teclado con las notas iluminadas: Do, Mi, Sol'
      })
    ).toBeVisible()
    await expect(
      card('Descansar un día').getByRole('img', { name: /Acorde G\..*cuerda 6: traste 3, dedo 2/ })
    ).toBeVisible()
    await expect(card('Descansar un día')).toContainText('no sustituye a un profesional')
    await expect(
      card('Descansar un día').getByRole('button', { name: 'Marcar como hecho' })
    ).toBeVisible()

    // An auxiliary step is marked by hand, and can be undone while nothing after it is done.
    await card('Descansar un día').getByRole('button', { name: 'Marcar como hecho' }).click()
    await expect(page.getByText('Pasos hechos: 2 de 3')).toBeVisible()
    await card('Descansar un día').getByRole('button', { name: 'Deshacer' }).click()
    await expect(page.getByText('Pasos hechos: 1 de 3')).toBeVisible()
    await card('Descansar un día').getByRole('button', { name: 'Marcar como hecho' }).click()

    // The last step is completed by practising, and the path is complete.
    await train('pushup', 85, 5)
    await reopen()
    await expect(page.getByText('Pasos hechos: 3 de 3')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: '¡Ruta completada!' })).toBeVisible()

    // Everything is still there after closing the app and opening it again.
    await app?.close()
    const again = await launch()
    await nav(again, 'Ruta').click()
    await expect(again.getByText('Pasos hechos: 3 de 3')).toBeVisible()
    await expect(again.getByText('¡Ruta completada!')).toBeVisible()
  })

  test('opens the calibration of the skill from the step that is next', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()
    provider.setAnswer({
      action: 'propose',
      requirement: { channels: ['body'] },
      path: {
        goal: 'Mejorar mi sentadilla',
        steps: [
          {
            title: 'Sentadilla lenta',
            description: '',
            kind: 'skill',
            skillId: 'squat',
            criterionSessions: 2,
            criterionScore: 75
          }
        ]
      }
    })
    await page.getByLabel('Tu mensaje').fill('Quiero mejorar mi sentadilla')
    await page.getByLabel('Tu mensaje').press('Enter')
    await page.getByRole('button', { name: 'Ver ruta completa' }).click()

    await page.getByRole('button', { name: 'Practicar' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: /Calibración · Sentadilla/ })
    ).toBeVisible()
  })

  test('applies only the changes of the weekly review that the person accepts', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)

    type Bridge = {
      api: {
        paths: {
          save: (path: unknown) => Promise<number>
          getCurrent: () => Promise<{ path: { steps: Array<{ id: number }> } } | null>
        }
      }
    }
    // A path with three steps, made as the planner would have saved it.
    const stepIds = await page.evaluate(async () => {
      const bridge = window as unknown as Bridge
      await bridge.api.paths.save({
        goal: 'Mejorar mi sentadilla',
        steps: [
          {
            title: 'Sentadilla lenta',
            description: 'Texto largo que no debe salir',
            kind: 'skill',
            skillId: 'squat',
            criterionSessions: 3,
            criterionScore: 80
          },
          {
            title: 'Descansar',
            description: '',
            kind: 'auxiliary',
            skillId: null,
            criterionSessions: null,
            criterionScore: null,
            guide: { tips: ['Hazlo despacio y sin dolor.', 'Respira con calma.'], minutes: 5 }
          },
          {
            title: 'Flexiones controladas',
            description: '',
            kind: 'skill',
            skillId: 'pushup',
            criterionSessions: 2,
            criterionScore: 70
          }
        ]
      })
      return (await bridge.api.paths.getCurrent())?.path.steps.map((step) => step.id) ?? []
    })
    const [squat, rest, pushup] = stepIds
    await nav(page, 'Mi ruta').click()
    const card = (title: string): ReturnType<Page['getByRole']> =>
      page.getByRole('listitem').filter({ hasText: title })

    provider.setAnswer({
      summary: 'Semana difícil: tus puntajes están por debajo de la meta.',
      adjustments: [
        {
          type: 'change-criteria',
          stepId: squat,
          criterionSessions: 2,
          criterionScore: 60,
          reason: 'Costó más de lo previsto.'
        },
        {
          type: 'add-step',
          afterStepId: rest,
          step: {
            title: 'Descanso extra',
            description: '',
            kind: 'auxiliary',
            skillId: null,
            criterionSessions: null,
            criterionScore: null,
            guide: { tips: ['Hazlo despacio y sin dolor.', 'Respira con calma.'], minutes: 5 }
          },
          reason: 'Recuperarse mejor.'
        },
        { type: 'remove-step', stepId: pushup, reason: 'Es demasiado pronto para las flexiones.' }
      ]
    })

    await page.getByRole('button', { name: 'Revisar mi semana' }).click()

    // The coach says how it went and proposes three changes, all ticked.
    await expect(page.getByText('Semana difícil')).toBeVisible()
    const boxes = page.getByRole('checkbox', { name: /Cambiar la meta|Añadir después|Quitar/ })
    await expect(boxes).toHaveCount(3)
    await expect(page.getByText('Motivo: Costó más de lo previsto.')).toBeVisible()
    for (const box of await boxes.all()) await expect(box).toBeChecked()

    // What was sent: the numbers of the path made by the app, with no descriptions.
    const sent = provider.received[0]?.body['messages'] as Array<{ role: string; content: string }>
    const [lead, json] = (sent[1]?.content ?? '').split('\n')
    expect(lead).toBe('Review this week of the learning path.')
    expect(json).not.toContain('Texto largo que no debe salir')
    expect(JSON.parse(json ?? '').steps.map((step: { id: number }) => step.id)).toEqual(stepIds)

    // The person leaves out the removal and applies the rest.
    await page.getByRole('checkbox', { name: /Quitar/ }).uncheck()
    await page.getByRole('button', { name: 'Aplicar los marcados' }).click()

    await expect(page.getByText('Cambios aplicados a tu ruta.')).toBeVisible()
    await expect(page.getByText('Meta: 2 sesiones con 60 puntos o más')).toBeVisible()
    await expect(page.getByRole('listitem').getByRole('heading', { level: 3 })).toHaveText([
      'Sentadilla lenta',
      'Descansar',
      'Descanso extra',
      'Flexiones controladas'
    ])

    // A review that is turned down changes nothing.
    provider.setAnswer({
      summary: 'Otra idea.',
      adjustments: [
        {
          type: 'change-criteria',
          stepId: squat,
          criterionSessions: 9,
          criterionScore: 10,
          reason: 'Otra.'
        }
      ]
    })
    await page.getByRole('button', { name: 'Revisar mi semana' }).click()
    await expect(page.getByText('Otra idea.')).toBeVisible()
    await page.getByRole('button', { name: 'Ahora no' }).click()

    await expect(card('Sentadilla lenta')).toContainText('Meta: 2 sesiones con 60 puntos o más')
    await expect(page.getByRole('listitem').getByRole('heading', { level: 3 })).toHaveCount(4)
  })

  test('says what is wrong when the review proposes something that cannot be applied twice', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await page.evaluate(() =>
      (
        window as unknown as { api: { paths: { save: (p: unknown) => Promise<number> } } }
      ).api.paths.save({
        goal: 'Mejorar',
        steps: [
          {
            title: 'Sentadilla lenta',
            description: '',
            kind: 'skill',
            skillId: 'squat',
            criterionSessions: 3,
            criterionScore: 80
          }
        ]
      })
    )
    await nav(page, 'Mi ruta').click()
    // A step that does not exist, which the coach is asked to fix and never does.
    provider.setAnswer({
      summary: 'x',
      adjustments: [{ type: 'remove-step', stepId: 9999, reason: 'No existe.' }]
    })

    await page.getByRole('button', { name: 'Revisar mi semana' }).click()

    await expect(page.getByRole('alert')).toContainText('La respuesta no tuvo el formato esperado')
    // The planner was asked three times: the first answer and two corrections.
    expect(provider.received).toHaveLength(3)
  })

  test('generates a skill, keeps it as a draft in the database, and does not offer it', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)

    const squat = JSON.parse(readFileSync('src/renderer/skills/squat.json', 'utf-8')) as object
    const yoga = { ...squat, id: 'custom_yoga', name: { es: 'Yoga suave', en: 'Gentle yoga' } }
    provider.setAnswer({ requirement: { channels: ['body'] }, skill: JSON.stringify(yoga) })

    const generate = (description: string): Promise<unknown> =>
      page.evaluate(
        (text) =>
          (
            window as unknown as {
              api: { coach: { generateSkill: (input: unknown) => Promise<unknown> } }
            }
          ).api.coach.generateSkill({
            description: text,
            language: 'es',
            existingSkillIds: ['squat', 'pushup', 'bicep_curl']
          }),
        description
      )

    // The page only learns the id: the skill itself stays in the main process.
    expect(await generate('Quiero aprender yoga suave')).toEqual({
      ok: true,
      value: { kind: 'skill', id: 'custom_yoga' }
    })

    // The model was told the format, and was sent only what the person wrote.
    const sent = provider.received[0]?.body['messages'] as Array<{ role: string; content: string }>
    expect(sent[0]?.content).toContain('"custom_"')
    expect(sent.slice(1)).toEqual([{ role: 'user', content: 'Quiero aprender yoga suave' }])

    // A draft is not a skill yet: it is not offered.
    await nav(page, 'Biblioteca').click()
    await expect(page.getByRole('button', { name: 'Yoga suave' })).toHaveCount(0)

    // What cannot be coached is declined, and the draft is still the previous one.
    provider.setAnswer({
      requirement: { channels: [], outOfScope: ['invisible-outcome'] },
      skill: ''
    })
    expect(await generate('Quiero aprender a meditar')).toEqual({
      ok: true,
      value: { kind: 'out-of-scope', reasons: ['invisible-outcome', 'no-signal'], measurable: [] }
    })
    await app?.close()

    const db = new DatabaseSync(join(userData, 'vyro.db'))
    const rows = db.prepare('SELECT id, status FROM custom_skills').all()
    db.close()
    expect(rows).toEqual([{ id: 'custom_yoga', status: 'draft' }])
  })

  async function makeYogaDraft(page: Page): Promise<void> {
    await turnOnWithFakeProvider(page)
    const squat = JSON.parse(readFileSync('src/renderer/skills/squat.json', 'utf-8')) as object
    const yoga = { ...squat, id: 'custom_yoga', name: { es: 'Yoga suave', en: 'Gentle yoga' } }
    provider.setAnswer({ requirement: { channels: ['body'] }, skill: JSON.stringify(yoga) })

    await nav(page, 'Biblioteca').click()
    await page.getByRole('button', { name: 'Crear una habilidad con el coach' }).click()
    await page.getByLabel('Qué habilidad quieres crear').fill('Quiero aprender yoga suave')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(
      page.getByRole('heading', { name: 'Revisa la habilidad antes de usarla' })
    ).toBeVisible()
  }

  test('shows what a generated skill will do, and keeps it out of the library until approved', async () => {
    const page = await launch()
    await makeYogaDraft(page)

    await expect(page.getByText('Yoga suave')).toBeVisible()
    await expect(page.getByText(/Experimental: la creó una IA/)).toBeVisible()
    await expect(page.getByText(/ángulo de rodilla, entre cadera y tobillo/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aprobar y probar' })).toBeVisible()

    // Looking at the preview is not approving it.
    await nav(page, 'Biblioteca').click()
    await expect(page.getByRole('button', { name: 'Yoga suave' })).toHaveCount(0)
  })

  test('discarding a draft removes it from the database', async () => {
    const page = await launch()
    await makeYogaDraft(page)

    await page.getByRole('button', { name: 'Descartar' }).click()
    await expect(page.getByLabel('Qué habilidad quieres crear')).toBeVisible()
    await app?.close()

    const db = new DatabaseSync(join(userData, 'vyro.db'))
    const rows = db.prepare('SELECT id FROM custom_skills').all()
    db.close()
    expect(rows).toEqual([])
  })

  test('approving a draft opens its calibration, and the skill appears in the library', async () => {
    const page = await launch()
    await makeYogaDraft(page)

    await page.getByRole('button', { name: 'Aprobar y probar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: /Calibración/ })).toBeVisible()

    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('button', { name: 'Yoga suave' })).toBeVisible()
    await app?.close()

    const db = new DatabaseSync(join(userData, 'vyro.db'))
    const rows = db.prepare('SELECT id, status FROM custom_skills').all()
    db.close()
    expect(rows).toEqual([{ id: 'custom_yoga', status: 'approved' }])
  })

  test('keeps a skill adjusted to the person, and refuses one that is not valid', async () => {
    const page = await launch()
    await makeYogaDraft(page)
    await page.getByRole('button', { name: 'Aprobar y probar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: /Calibración/ })).toBeVisible()

    const squat = JSON.parse(readFileSync('src/renderer/skills/squat.json', 'utf-8')) as {
      rules: Array<{ id: string; check: string }>
    }
    const save = (check: string): Promise<boolean> =>
      page.evaluate(
        ([id, config]) =>
          (
            window as unknown as {
              api: { skills: { saveCalibrated: (id: string, config: unknown) => Promise<boolean> } }
            }
          ).api.skills.saveCalibrated(id as string, config),
        [
          'custom_yoga',
          {
            ...squat,
            id: 'custom_yoga',
            name: { es: 'Yoga suave', en: 'Gentle yoga' },
            rules: squat.rules.map((rule) => (rule.id === 'depth' ? { ...rule, check } : rule))
          }
        ] as const
      )

    expect(await save('process.exit(1)')).toBe(false)
    expect(await save('min(knee) <= 108')).toBe(true)
    await app?.close()

    const db = new DatabaseSync(join(userData, 'vyro.db'))
    const row = db.prepare('SELECT config_json FROM custom_skills').get() as { config_json: string }
    db.close()
    expect(row.config_json).toContain('min(knee) <= 108')
    expect(row.config_json).not.toContain('process.exit')
  })

  test('deletes a generated skill from Settings after asking, and keeps its sessions', async () => {
    const page = await launch()
    await makeYogaDraft(page)
    await page.getByRole('button', { name: 'Aprobar y probar' }).click()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('button', { name: 'Yoga suave' })).toBeVisible()

    await page.evaluate(() =>
      (
        window as unknown as {
          api: { sessions: { save: (session: unknown) => Promise<number> } }
        }
      ).api.sessions.save({
        skillId: 'custom_yoga',
        startedAt: 1,
        durationMs: 1000,
        score: 100,
        reps: [{ index: 1, quality: 'good', durationMs: 900, failedRuleIds: [] }]
      })
    )

    await nav(page, 'Ajustes').click()
    await page.getByRole('tab', { name: 'Mis habilidades generadas' }).click()
    await page.getByRole('button', { name: 'Eliminar Yoga suave' }).click()
    // Asking first: nothing is deleted yet, and cancelling leaves the skill.
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await nav(page, 'Biblioteca').click()
    await expect(page.getByRole('button', { name: 'Yoga suave' })).toBeVisible()

    await nav(page, 'Ajustes').click()
    await page.getByRole('tab', { name: 'Mis habilidades generadas' }).click()
    await page.getByRole('button', { name: 'Eliminar Yoga suave' }).click()
    await page.getByRole('button', { name: 'Sí, eliminar' }).click()
    await expect(page.getByText('Habilidad eliminada.')).toBeVisible()

    await nav(page, 'Biblioteca').click()
    await expect(page.getByRole('button', { name: 'Yoga suave' })).toHaveCount(0)
    await app?.close()

    const db = new DatabaseSync(join(userData, 'vyro.db'))
    const skills = db.prepare('SELECT id FROM custom_skills').all()
    const sessions = db.prepare('SELECT skill_id FROM sessions').all()
    db.close()
    expect(skills).toEqual([])
    expect(sessions).toEqual([{ skill_id: 'custom_yoga' }])
  })

  test('explains why a path cannot be made, and lets the person start again', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()
    provider.setAnswer({
      action: 'ask',
      requirement: { channels: [], outOfScope: ['invisible-outcome'] },
      question: '¿Qué tipo de meditación?'
    })

    await page.getByLabel('Tu mensaje').fill('Quiero aprender a meditar')
    await page.getByLabel('Tu mensaje').press('Enter')

    await expect(page.getByRole('heading', { name: 'VYRO no puede entrenar eso' })).toBeVisible()
    await expect(page.getByText('El resultado no se puede ver ni oír')).toBeVisible()
    // The app decided, not the model: the question it asked was never shown.
    await expect(page.getByText('¿Qué tipo de meditación?')).toHaveCount(0)

    await page.getByRole('button', { name: 'Probar con otra cosa' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: '¿Qué quieres aprender?' })
    ).toBeVisible()
  })

  test('invites to ask the coach when there is no path to follow', async () => {
    const page = await launch()

    await nav(page, 'Mi ruta').click()

    await expect(page.getByText(/Todavía no sigues ninguna ruta/)).toBeVisible()
    await page.getByRole('button', { name: 'Hablar con el coach' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: '¿Qué quieres aprender?' })
    ).toBeVisible()
    await expect(page.getByLabel('Tu mensaje')).toBeFocused()
  })

  test('lists every saved path, resumes an archived one and deletes another', async () => {
    const page = await launch()
    const save = (goal: string): Promise<unknown> =>
      page.evaluate(
        (name) =>
          (
            window as unknown as { api: { paths: { save: (path: unknown) => Promise<number> } } }
          ).api.paths.save({
            goal: name,
            steps: [
              {
                title: 'Descansar',
                description: '',
                kind: 'auxiliary',
                skillId: null,
                criterionSessions: null,
                criterionScore: null
              }
            ]
          }),
        goal
      )
    await save('Primera ruta')
    await save('Segunda ruta')
    await save('Tercera ruta')

    await nav(page, 'Mi ruta').click()

    const list = page.getByRole('list').filter({ hasText: 'Primera ruta' })
    await expect(page.getByRole('heading', { level: 2, name: 'Mis rutas' })).toBeVisible()
    await expect(list.getByRole('listitem')).toHaveCount(3)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tercera ruta')

    await list
      .getByRole('listitem')
      .filter({ hasText: 'Primera ruta' })
      .getByRole('button', { name: 'Retomar' })
      .click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Primera ruta')

    const second = list.getByRole('listitem').filter({ hasText: 'Segunda ruta' })
    await second.getByRole('button', { name: 'Eliminar' }).click()
    await second.getByRole('button', { name: 'Sí, eliminar' }).click()
    await expect(list.getByRole('listitem')).toHaveCount(2)
    await expect(list).not.toContainText('Segunda ruta')
  })

  test('writes a new line with Shift + Enter instead of sending', async () => {
    const page = await launch()
    await turnOnWithFakeProvider(page)
    await nav(page, 'Inicio').click()

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
    await first.getByRole('tab', { name: 'Coach con IA' }).click()
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
    expect(exposed.methods).toEqual(['clearKey', 'keyStatus', 'saveKey', 'usageToday'])
    expect(JSON.stringify(exposed.status)).not.toContain(SECRET)

    // On disk, only the encrypted bytes.
    expect(readFileSync(join(userData, 'ai-key.bin')).toString('latin1')).not.toContain(SECRET)
    await app?.close()

    const second = await launch()
    await nav(second, 'Ajustes').click()
    await second.getByRole('tab', { name: 'Coach con IA' }).click()
    await expect(second.getByText('Clave guardada en este equipo')).toBeVisible()

    await second.getByRole('button', { name: 'Quitar clave' }).click()
    await expect(second.getByText('Aún no has guardado ninguna clave')).toBeVisible()
  })
})
