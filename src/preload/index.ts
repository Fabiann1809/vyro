import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AuthResult } from '@shared/account'
import { IPC, type VyroApi } from '@shared/ipc'

// The only surface exposed to the renderer. Typed methods are added here as features need them.
const api: VyroApi = {
  platform: process.platform,
  localData: {
    check: () => ipcRenderer.invoke(IPC.localDataCheck),
    resolve: (choice) => ipcRenderer.invoke(IPC.localDataResolve, choice)
  },
  account: {
    status: () => ipcRenderer.invoke(IPC.accountStatus),
    signIn: (input) => ipcRenderer.invoke(IPC.accountSignIn, input),
    signInWithGoogle: () => ipcRenderer.invoke(IPC.accountSignInWithGoogle),
    onResult: (listener) => {
      const forward = (_event: IpcRendererEvent, result: AuthResult): void => listener(result)
      ipcRenderer.on(IPC.accountResult, forward)
      return () => void ipcRenderer.removeListener(IPC.accountResult, forward)
    },
    takeReturn: () => ipcRenderer.invoke(IPC.accountTakeReturn),
    signUp: (input) => ipcRenderer.invoke(IPC.accountSignUp, input),
    verifyEmailCode: (input) => ipcRenderer.invoke(IPC.accountVerifyEmailCode, input),
    requestPasswordReset: (input) => ipcRenderer.invoke(IPC.accountRequestPasswordReset, input),
    resetPassword: (input) => ipcRenderer.invoke(IPC.accountResetPassword, input),
    signOut: (force) => ipcRenderer.invoke(IPC.accountSignOut, force),
    deleteAccount: () => ipcRenderer.invoke(IPC.accountDeleteAccount),
    syncInfo: () => ipcRenderer.invoke(IPC.accountSyncInfo)
  },
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
