import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'

// The microphone is off unless a skill that listens is open. This asks for it from the page, the way
// any code in the page could, and looks at what the app answers.

let app: ElectronApplication | undefined
let userData: string

test.beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), 'vyro-mic-'))
})

test.afterEach(async () => {
  await app?.close()
  app = undefined
  rmSync(userData, { recursive: true, force: true })
})

async function launch(extra: string[] = []): Promise<Page> {
  app = await electron.launch({
    args: [
      '.',
      `--user-data-dir=${userData}`,
      // Chromium's own fake devices stand in for a microphone and a camera, so that the answer is
      // about the permission and not about what the computer has (a runner has neither).
      '--use-fake-device-for-media-stream',
      ...extra,
      ...(process.env['CI'] ? ['--no-sandbox'] : [])
    ]
  })
  return app.firstWindow()
}

// What happens when the page asks for the microphone: the name of the error, or 'opened'. A computer
// with no microphone would answer NotFoundError, which is why the tests use a fake one.
const ask = (page: Page, constraints: { audio: boolean; video?: boolean }): Promise<string> =>
  page.evaluate(async (wanted) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(wanted)
      stream.getTracks().forEach((track) => track.stop())
      return 'opened'
    } catch (error) {
      return error instanceof Error ? error.name : 'unknown'
    }
  }, constraints)

const setOpen = (page: Page, open: boolean): Promise<void> =>
  page.evaluate(
    (value) =>
      (
        window as unknown as { api: { microphone: { setOpen: (open: boolean) => Promise<void> } } }
      ).api.microphone.setOpen(value),
    open
  )

test('refuses the microphone until a skill that listens is open, and again after it closes', async () => {
  const page = await launch()

  expect(await ask(page, { audio: true })).toBe('NotAllowedError')
  // Asking for the camera together with it does not get it in either.
  expect(await ask(page, { audio: true, video: true })).toBe('NotAllowedError')

  await setOpen(page, true)
  expect(await ask(page, { audio: true })).toBe('opened')

  await setOpen(page, false)
  expect(await ask(page, { audio: true })).toBe('NotAllowedError')
})

test('closes the microphone again when the page is loaded anew', async () => {
  const page = await launch()
  await setOpen(page, true)
  expect(await ask(page, { audio: true })).toBe('opened')

  await page.reload()

  await expect.poll(() => ask(page, { audio: true }), { timeout: 10_000 }).toBe('NotAllowedError')
})

test('only a true opens it: anything else leaves it closed', async () => {
  const page = await launch()

  await page.evaluate(() =>
    (
      window as unknown as { api: { microphone: { setOpen: (open: unknown) => Promise<void> } } }
    ).api.microphone.setOpen('yes')
  )

  expect(await ask(page, { audio: true })).toBe('NotAllowedError')
})

test('the test button in Settings listens only while it is on', async () => {
  const page = await launch()
  await page.getByRole('navigation').getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('tab', { name: 'Micrófono' }).click()

  await page.getByRole('button', { name: 'Probar micrófono' }).click()
  // A computer with a microphone shows the level; one without it says so. Either way the page asked.
  await expect(
    page
      .getByRole('meter', { name: 'Nivel del micrófono' })
      .or(page.getByRole('alert').filter({ hasText: 'micrófono' }))
  ).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Parar la prueba' }).click()
  await expect(page.getByRole('meter')).toHaveCount(0)
  // Once it stops, the microphone is closed again.
  await expect.poll(() => ask(page, { audio: true })).toBe('NotAllowedError')
})

test('a skill that only listens is calibrated with the microphone, not the camera', async () => {
  const page = await launch()

  await page.getByRole('navigation').getByRole('button', { name: 'Biblioteca' }).click()
  await page.getByRole('button', { name: 'Afinar una cuerda' }).click()

  await expect(
    page.getByRole('heading', { level: 1, name: /Calibración · Afinar una cuerda/ })
  ).toBeVisible()
  await expect(page.getByText('Ruido de la sala', { exact: true })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Sonido' })).toBeVisible()
  await expect(page.getByText('Cuerpo completo')).toHaveCount(0)
  await expect(page.locator('video')).toHaveCount(0)
  // The microphone really opened: the level is on show.
  await expect(page.getByRole('meter', { name: 'Nivel del micrófono' })).toBeVisible({
    timeout: 15_000
  })

  // Leaving the screen lets go of it.
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect.poll(() => ask(page, { audio: true })).toBe('NotAllowedError')
})
