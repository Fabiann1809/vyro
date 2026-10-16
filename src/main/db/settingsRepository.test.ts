import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { openDatabase, type Database } from './database'
import { SettingsRepository } from './settingsRepository'

let db: Database
let repository: SettingsRepository

beforeEach(() => {
  db = openDatabase(':memory:')
  repository = new SettingsRepository(db)
})

describe('SettingsRepository', () => {
  it('gives the defaults when nothing has been saved', () => {
    expect(repository.getAll()).toEqual(DEFAULT_SETTINGS)
  })

  it('saves only the settings that changed and keeps the rest', () => {
    repository.set({ language: 'en', volume: 0.3 })
    repository.set({ cameraId: 'cam-2' })

    expect(repository.getAll()).toEqual({
      ...DEFAULT_SETTINGS,
      language: 'en',
      volume: 0.3,
      cameraId: 'cam-2'
    })
  })

  it('can go back to the system camera', () => {
    repository.set({ cameraId: 'cam-2' })
    repository.set({ cameraId: null })

    expect(repository.getAll().cameraId).toBeNull()
  })

  it('keeps false and zero, which are values and not absences', () => {
    repository.set({ voiceEnabled: false, volume: 0 })

    expect(repository.getAll()).toMatchObject({ voiceEnabled: false, volume: 0 })
  })

  it('falls back to the default for a stored value that makes no sense', () => {
    db.exec("INSERT INTO settings (key, value) VALUES ('language', '\"fr\"')")
    db.exec("INSERT INTO settings (key, value) VALUES ('volume', 'not json')")
    db.exec("INSERT INTO settings (key, value) VALUES ('somethingOld', '1')")

    expect(repository.getAll()).toEqual(DEFAULT_SETTINGS)
  })

  it('forgets everything on delete', () => {
    repository.set({ language: 'en' })

    repository.deleteAll()

    expect(repository.getAll()).toEqual(DEFAULT_SETTINGS)
  })

  it('survives closing and opening the database file', () => {
    const folder = mkdtempSync(join(tmpdir(), 'vyro-settings-'))
    try {
      const path = join(folder, 'vyro.db')
      const first = openDatabase(path)
      new SettingsRepository(first).set({ language: 'en', theme: 'light' })
      first.close()

      const second = openDatabase(path)
      expect(new SettingsRepository(second).getAll()).toMatchObject({
        language: 'en',
        theme: 'light'
      })
      second.close()
    } finally {
      rmSync(folder, { recursive: true, force: true })
    }
  })
})
