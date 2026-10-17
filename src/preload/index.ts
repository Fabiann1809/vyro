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
  ai: {
    keyStatus: () => ipcRenderer.invoke(IPC.aiKeyStatus),
    saveKey: (key) => ipcRenderer.invoke(IPC.aiKeySave, key),
    clearKey: () => ipcRenderer.invoke(IPC.aiKeyClear)
  },
  coach: {
    chat: (input) => ipcRenderer.invoke(IPC.coachChat, input),
    summarize: (input) => ipcRenderer.invoke(IPC.coachSummarize, input),
    planPath: (input) => ipcRenderer.invoke(IPC.coachPlanPath, input),
    reviewPath: (input) => ipcRenderer.invoke(IPC.coachReviewPath, input)
  },
  paths: {
    getCurrent: () => ipcRenderer.invoke(IPC.pathsGetCurrent),
    save: (path) => ipcRenderer.invoke(IPC.pathsSave, path),
    setStepDone: (stepId, done) => ipcRenderer.invoke(IPC.pathsSetStepDone, stepId, done),
    archive: (pathId) => ipcRenderer.invoke(IPC.pathsArchive, pathId),
    applyAdjustments: (input) => ipcRenderer.invoke(IPC.pathsApplyAdjustments, input)
  },
  skills: {
    listCustom: () => ipcRenderer.invoke(IPC.skillsListCustom)
  },
  data: {
    deleteAll: () => ipcRenderer.invoke(IPC.dataDeleteAll)
  }
}

contextBridge.exposeInMainWorld('api', api)
