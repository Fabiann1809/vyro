import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type VyroApi } from '@shared/ipc'

// The only surface exposed to the renderer. Typed methods are added here as features need them.
const api: VyroApi = {
  platform: process.platform,
  camera: {
    requestAccess: () => ipcRenderer.invoke(IPC.cameraRequestAccess),
    openSystemSettings: () => ipcRenderer.invoke(IPC.cameraOpenSettings)
  },
  sessions: {
    save: (session) => ipcRenderer.invoke(IPC.sessionsSave, session),
    list: (query) => ipcRenderer.invoke(IPC.sessionsList, query),
    get: (id) => ipcRenderer.invoke(IPC.sessionsGet, id),
    errorCounts: (skillId) => ipcRenderer.invoke(IPC.sessionsErrorCounts, skillId)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    set: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch)
  },
  data: {
    deleteAll: () => ipcRenderer.invoke(IPC.dataDeleteAll)
  }
}

contextBridge.exposeInMainWorld('api', api)
