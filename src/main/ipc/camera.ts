import { ipcMain, shell, systemPreferences } from 'electron'
import { cameraSettingsUrl, type CameraAccessStatus } from '@shared/camera'
import { IPC } from '@shared/ipc'

// macOS asks for camera access through the OS; other systems prompt when the stream opens.
async function requestCameraAccess(): Promise<CameraAccessStatus> {
  if (process.platform !== 'darwin') return 'unknown'

  const status = systemPreferences.getMediaAccessStatus('camera')
  if (status === 'not-determined') {
    return (await systemPreferences.askForMediaAccess('camera')) ? 'granted' : 'denied'
  }
  return status
}

export function registerCameraIpc(): void {
  ipcMain.handle(IPC.cameraRequestAccess, requestCameraAccess)

  ipcMain.handle(IPC.cameraOpenSettings, async () => {
    const url = cameraSettingsUrl(process.platform)
    if (url) await shell.openExternal(url)
  })
}
