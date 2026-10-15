import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type VyroApi } from '@shared/ipc'

// The only surface exposed to the renderer. Typed methods are added here as features need them.
const api: VyroApi = {
  platform: process.platform,
  camera: {
    requestAccess: () => ipcRenderer.invoke(IPC.cameraRequestAccess),
    openSystemSettings: () => ipcRenderer.invoke(IPC.cameraOpenSettings)
  }
}

contextBridge.exposeInMainWorld('api', api)
