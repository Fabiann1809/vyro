import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type VyroApi } from '@shared/ipc'

// The only surface exposed to the renderer. Typed methods are added here as features need them.
const api: VyroApi = {
  platform: process.platform,
  camera: {
    requestAccess: () => ipcRenderer.invoke(IPC.cameraRequestAccess),
    openSystemSettings: () => ipcRenderer.invoke(IPC.cameraOpenSettings)
  },
  microphone: {
    setOpen: (open) => ipcRenderer.invoke(IPC.microphoneSetOpen, open),
    requestAccess: () => ipcRenderer.invoke(IPC.microphoneRequestAccess)
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
    usageToday: () => ipcRenderer.invoke(IPC.aiUsageToday),
    saveKey: (key) => ipcRenderer.invoke(IPC.aiKeySave, key),
    clearKey: () => ipcRenderer.invoke(IPC.aiKeyClear)
  },
  coach: {
    chat: (input) => ipcRenderer.invoke(IPC.coachChat, input),
    summarize: (input) => ipcRenderer.invoke(IPC.coachSummarize, input),
    planPath: (input) => ipcRenderer.invoke(IPC.coachPlanPath, input),
    reviewPath: (input) => ipcRenderer.invoke(IPC.coachReviewPath, input),
    generateSkill: (input) => ipcRenderer.invoke(IPC.coachGenerateSkill, input)
  },
  paths: {
    getCurrent: () => ipcRenderer.invoke(IPC.pathsGetCurrent),
    list: () => ipcRenderer.invoke(IPC.pathsList),
    resume: (pathId) => ipcRenderer.invoke(IPC.pathsResume, pathId),
    delete: (pathId) => ipcRenderer.invoke(IPC.pathsDelete, pathId),
    save: (path) => ipcRenderer.invoke(IPC.pathsSave, path),
    setStepDone: (stepId, done) => ipcRenderer.invoke(IPC.pathsSetStepDone, stepId, done),
    archive: (pathId) => ipcRenderer.invoke(IPC.pathsArchive, pathId),
    applyAdjustments: (input) => ipcRenderer.invoke(IPC.pathsApplyAdjustments, input)
  },
  skills: {
    listCustom: () => ipcRenderer.invoke(IPC.skillsListCustom),
    getDraft: () => ipcRenderer.invoke(IPC.skillsGetDraft),
    approveDraft: (id) => ipcRenderer.invoke(IPC.skillsApproveDraft, id),
    discardDraft: (id) => ipcRenderer.invoke(IPC.skillsDiscardDraft, id),
    saveCalibrated: (id, config) => ipcRenderer.invoke(IPC.skillsSaveCalibrated, id, config),
    delete: (id) => ipcRenderer.invoke(IPC.skillsDelete, id)
  },
  data: {
    deleteAll: () => ipcRenderer.invoke(IPC.dataDeleteAll)
  }
}

contextBridge.exposeInMainWorld('api', api)
