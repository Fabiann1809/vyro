import { ipcMain, systemPreferences } from 'electron'
import type { CameraAccessStatus } from '@shared/camera'
import { IPC } from '@shared/ipc'
import type { MicrophoneGate } from '../mediaPermissions'

// macOS asks for microphone access through the OS; other systems prompt when the stream opens.
async function requestMicrophoneAccess(): Promise<CameraAccessStatus> {
  if (process.platform !== 'darwin') return 'unknown'

  const status = systemPreferences.getMediaAccessStatus('microphone')
  if (status === 'not-determined') {
    return (await systemPreferences.askForMediaAccess('microphone')) ? 'granted' : 'denied'
  }
  return status
}

export function registerMicrophoneIpc(gate: MicrophoneGate): void {
  ipcMain.handle(IPC.microphoneSetOpen, (_event, open: unknown) => {
    if (open === true) gate.open()
    else gate.close()
  })
  ipcMain.handle(IPC.microphoneRequestAccess, requestMicrophoneAccess)
}
