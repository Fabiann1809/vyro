import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

// Tuning a string with a microphone that "plays" a steady low E (82.41 Hz), made as a sound file for
// the fake device of Chromium. It checks the tuner screen end to end: the string to tune, that the
// string is marked as done after staying in tune, and that it moves on to the next one.

let app: ElectronApplication | undefined
let folder: string

test.beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'vyro-tuner-'))
})

test.afterEach(async () => {
  await app?.close()
  app = undefined
  rmSync(folder, { recursive: true, force: true })
})

// A 16 bit mono WAV that is quiet first, so that the calibration measures the room before the note
// starts, and then a quiet sine of a whole number of cycles, so that it has no click.
function sineWav(hz: number, quietSeconds: number, cycles: number): Buffer {
  const rate = 48_000
  const quiet = Math.round(rate * quietSeconds)
  const count = quiet + Math.round((rate * cycles) / hz)
  const data = Buffer.alloc(count * 2)
  for (let index = quiet; index < count; index++) {
    const sample = 0.2 * Math.sin((2 * Math.PI * hz * (index - quiet)) / rate)
    data.writeInt16LE(Math.round(sample * 32767), index * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

test('tunes a string: shows which one, marks it as done and moves on to the next', async () => {
  test.setTimeout(180_000)
  const wav = join(folder, 'low-e.wav')
  writeFileSync(wav, sineWav(82.41, 5, 2060))
  app = await electron.launch({
    args: [
      '.',
      `--user-data-dir=${join(folder, 'data')}`,
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${wav}`,
      ...(process.env['CI'] ? ['--no-sandbox'] : [])
    ]
  })
  const page = await app.firstWindow()

  await page.getByRole('navigation').getByRole('button', { name: 'Biblioteca' }).click()
  await page.getByRole('button', { name: 'Afinar una cuerda' }).click()

  await expect(page.getByText('Afina a')).toBeVisible({ timeout: 90_000 })
  // Six strings to choose from, and no counter of repetitions.
  await expect(page.getByRole('button', { name: /^(Mi|La|Re|Sol|Si) \d/ })).toHaveCount(6)
  await expect(page.getByText('repeticiones')).toHaveCount(0)

  // After a second in tune the first string is done and the second one is next.
  await expect(page.getByText('1 de 6 cuerdas afinadas')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: /^La 2/ })).toHaveAttribute('aria-pressed', 'true')
})
