import { mkdtempSync, rmSync } from 'node:fs'
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
