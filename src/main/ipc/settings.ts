import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { settingsPatchSchema, type AppSettings } from '@shared/settings'
import type { ApiKeyStore } from '../ai/keyStore'
import type { PathRepository } from '../db/pathRepository'
import type { SessionRepository } from '../db/sessionRepository'
import type { SettingsRepository } from '../db/settingsRepository'

// What each channel does, apart from Electron so it can be tested. Every argument is validated.
export function createSettingsHandlers(
  settings: SettingsRepository,
  sessions: SessionRepository,
  paths: PathRepository,
  keyStore: ApiKeyStore
): {
  get: () => AppSettings
  set: (patch: unknown) => void
  deleteAllData: () => void
} {
  return {
    get: () => settings.getAll(),
    set: (patch) => settings.set(settingsPatchSchema.parse(patch)),
    // "Delete all data" empties the database (sessions, paths and settings) and forgets the API key.
    deleteAllData: () => {
      sessions.deleteAll()
      paths.deleteAll()
      settings.deleteAll()
      keyStore.clear()
    }
  }
}

export function registerSettingsIpc(
  settings: SettingsRepository,
  sessions: SessionRepository,
  paths: PathRepository,
  keyStore: ApiKeyStore
): void {
  const handlers = createSettingsHandlers(settings, sessions, paths, keyStore)

  ipcMain.handle(IPC.settingsGet, () => handlers.get())
  ipcMain.handle(IPC.settingsSet, (_event, patch: unknown) => handlers.set(patch))
  ipcMain.handle(IPC.dataDeleteAll, () => handlers.deleteAllData())
}
