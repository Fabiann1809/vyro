import type { AiKeyStatus } from './ai'
import type { CameraAccessStatus } from './camera'
import type { AppSettings, SettingsPatch } from './settings'
import type { ErrorCount, SessionDetail, SessionQuery, SessionRow, SessionToSave } from './sessions'

export const IPC = {
  cameraRequestAccess: 'camera:request-access',
  cameraOpenSettings: 'camera:open-settings',
  sessionsSave: 'sessions:save',
  sessionsList: 'sessions:list',
  sessionsGet: 'sessions:get',
  sessionsErrorCounts: 'sessions:error-counts',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  dataDeleteAll: 'data:delete-all',
  aiKeyStatus: 'ai:key-status',
  aiKeySave: 'ai:key-save',
  aiKeyClear: 'ai:key-clear'
} as const

// The only API the renderer can call. Everything else stays in the main process.
export interface VyroApi {
  platform: string
  camera: {
    requestAccess: () => Promise<CameraAccessStatus>
    openSystemSettings: () => Promise<void>
  }
  sessions: {
    // Returns the id of the saved session.
    save: (session: SessionToSave) => Promise<number>
    list: (query?: SessionQuery) => Promise<SessionRow[]>
    get: (id: number) => Promise<SessionDetail | null>
    errorCounts: (skillId?: string) => Promise<ErrorCount[]>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (patch: SettingsPatch) => Promise<void>
  }
  ai: {
    // Whether a key exists; its value never reaches the page.
    keyStatus: () => Promise<AiKeyStatus>
    saveKey: (key: string) => Promise<void>
    clearKey: () => Promise<void>
  }
  data: {
    // Empties the database: sessions and settings.
    deleteAll: () => Promise<void>
  }
}
