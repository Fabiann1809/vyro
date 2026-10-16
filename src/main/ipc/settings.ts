import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { settingsPatchSchema, type AppSettings } from '@shared/settings'
import type { SessionRepository } from '../db/sessionRepository'
import type { SettingsRepository } from '../db/settingsRepository'

// What each channel does, apart from Electron so it can be tested. Every argument is validated.
export function createSettingsHandlers(
  settings: SettingsRepository,
  sessions: SessionRepository
): {
  get: () => AppSettings
  set: (patch: unknown) => void
  deleteAllData: () => void
} {
  return {
    get: () => settings.getAll(),
    set: (patch) => settings.set(settingsPatchSchema.parse(patch)),
    // "Delete all data" empties the database: the sessions and the settings.
    deleteAllData: () => {
      sessions.deleteAll()
      settings.deleteAll()
    }
  }
}

export function registerSettingsIpc(
  settings: SettingsRepository,
  sessions: SessionRepository
): void {
  const handlers = createSettingsHandlers(settings, sessions)

  ipcMain.handle(IPC.settingsGet, () => handlers.get())
  ipcMain.handle(IPC.settingsSet, (_event, patch: unknown) => handlers.set(patch))
  ipcMain.handle(IPC.dataDeleteAll, () => handlers.deleteAllData())
}
