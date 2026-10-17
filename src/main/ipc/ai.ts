import { ipcMain } from 'electron'
import { apiKeySchema, type AiKeyStatus } from '@shared/ai'
import { IPC } from '@shared/ipc'
import type { ApiKeyStore } from '../ai/keyStore'

// What each channel does, apart from Electron so it can be tested. The key goes in and never
// comes out: the status only says whether there is one.
export function createAiHandlers(keyStore: ApiKeyStore): {
  keyStatus: () => AiKeyStatus
  saveKey: (key: unknown) => void
  clearKey: () => void
} {
  return {
    keyStatus: () => keyStore.status(),
    saveKey: (key) => {
      const parsed = apiKeySchema.safeParse(key)
      // A fixed message: the value that failed must not travel back to the page or to a log.
      if (!parsed.success) throw new Error('The API key is not valid.')
      keyStore.save(parsed.data)
    },
    clearKey: () => keyStore.clear()
  }
}

export function registerAiIpc(keyStore: ApiKeyStore): void {
  const handlers = createAiHandlers(keyStore)

  ipcMain.handle(IPC.aiKeyStatus, () => handlers.keyStatus())
  ipcMain.handle(IPC.aiKeySave, (_event, key: unknown) => handlers.saveKey(key))
  ipcMain.handle(IPC.aiKeyClear, () => handlers.clearKey())
}
