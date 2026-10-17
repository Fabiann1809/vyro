import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { ApiKeyStore, type KeyFile } from '../ai/keyStore'
import { openDatabase } from '../db/database'
import { CustomSkillRepository } from '../db/customSkillRepository'
import { PathRepository } from '../db/pathRepository'
import { SessionRepository } from '../db/sessionRepository'
import { SettingsRepository } from '../db/settingsRepository'
import { createSettingsHandlers } from './settings'

// The handlers do not need Electron, but the module imports it.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

let handlers: ReturnType<typeof createSettingsHandlers>
let sessions: SessionRepository
let keyStore: ApiKeyStore
let paths: PathRepository
let customSkills: CustomSkillRepository

beforeEach(() => {
  const db = openDatabase(':memory:')
  sessions = new SessionRepository(db)
  paths = new PathRepository(db)
  customSkills = new CustomSkillRepository(db)
  let keyFile: Buffer | null = null
  const file: KeyFile = {
    read: () => keyFile,
    write: (data) => void (keyFile = data),
    remove: () => void (keyFile = null)
  }
  keyStore = new ApiKeyStore(
    {
      isEncryptionAvailable: () => true,
      encryptString: (plain) => Buffer.from(plain),
      decryptString: (encrypted) => encrypted.toString()
    },
    file
  )
  handlers = createSettingsHandlers(
    new SettingsRepository(db),
    sessions,
    paths,
    customSkills,
    keyStore
  )
})

describe('settings handlers', () => {
  it('saves a change and reads it back', () => {
    handlers.set({ language: 'en', volume: 0.5 })

    expect(handlers.get()).toEqual({ ...DEFAULT_SETTINGS, language: 'en', volume: 0.5 })
  })

  it.each([
    ['an unknown language', { language: 'fr' }],
    ['a volume above 1', { volume: 1.5 }],
    ['a setting that does not exist', { cheatMode: true }],
    ['an empty camera id', { cameraId: '' }],
    ['something that is not an object', 'dark']
  ])('rejects %s', (_name, patch) => {
    expect(() => handlers.set(patch)).toThrow()
    expect(handlers.get()).toEqual(DEFAULT_SETTINGS)
  })

  it('empties the database on "delete all data"', () => {
    handlers.set({ language: 'en' })
    sessions.save({
      skillId: 'squat',
      startedAt: 1,
      durationMs: 1,
      score: 100,
      reps: [{ index: 1, quality: 'good', durationMs: 1, failedRuleIds: [] }]
    })

    keyStore.save('sk-test-1234567890')
    paths.create(
      {
        goal: 'Aprender yoga',
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
      },
      1
    )

    customSkills.save('custom_yoga', { id: 'custom_yoga' }, 'approved', 1)

    handlers.deleteAllData()

    expect(customSkills.list()).toEqual([])
    expect(paths.list()).toEqual([])
    expect(keyStore.status().hasKey).toBe(false)
    expect(sessions.list()).toEqual([])
    expect(handlers.get()).toEqual(DEFAULT_SETTINGS)
  })
})
