import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

// A skill that asks to hear a flute, with the fake microphone of Chromium, which only beeps. The
// beep is not a flute, so the calibration must say so. (That a real flute is accepted is covered by
// the unit tests: there is no way to make a flute sound here.)

let app: ElectronApplication | undefined
let userData: string

test.beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), 'vyro-instrument-'))
})

test.afterEach(async () => {
  await app?.close()
  app = undefined
  rmSync(userData, { recursive: true, force: true })
})

const launch = async (): Promise<ElectronApplication> =>
  electron.launch({
    args: [
      '.',
      `--user-data-dir=${userData}`,
      '--use-fake-device-for-media-stream',
      ...(process.env['CI'] ? ['--no-sandbox'] : [])
    ]
  })

test('says that the beep of a fake microphone is not the flute that the skill asks for', async () => {
  test.setTimeout(120_000)
  app = await launch()
  await (await app.firstWindow()).title()
  await app.close()

  const beat = JSON.parse(readFileSync('src/renderer/skills/steady-beat.json', 'utf-8')) as {
    metrics: object
    rep: object
    display?: string
    audio?: object
  }
  // The pulse of the steady beat does not go with a flute: only its base is borrowed.
  const flute = {
    ...beat,
    display: undefined,
    audio: undefined,
    id: 'custom_flute',
    name: { es: 'Soplar la flauta', en: 'Blow the flute' },
    rep: { sequence: ['quiet', 'hit', 'quiet'], minDurationMs: 300 },
    metrics: { level: { type: 'level' }, flute: { type: 'instrument', name: 'flute' } },
    rules: [
      {
        id: 'not_flute',
        severity: 'high',
        check: 'avg(flute) >= 0.5',
        message: { es: 'No suena a flauta', en: 'It does not sound like a flute' }
      }
    ]
  }
  const db = new DatabaseSync(join(userData, 'vyro.db'))
  db.prepare(
    'INSERT INTO custom_skills (id, config_json, status, created_at) VALUES (?, ?, ?, ?)'
  ).run('custom_flute', JSON.stringify(flute), 'approved', 1)
  db.close()

  app = await launch()
  const page = await app.firstWindow()
  await page.getByRole('navigation').getByRole('button', { name: 'Biblioteca' }).click()
  await page.getByRole('button', { name: 'Soplar la flauta' }).click()

  await expect(page.getByText(/No oigo una flauta/)).toBeVisible({ timeout: 60_000 })
})
