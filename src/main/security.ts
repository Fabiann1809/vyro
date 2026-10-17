import { session, shell, type BrowserWindow } from 'electron'
import { mayCheckMedia, mayOpenMedia, type MicrophoneGate } from './mediaPermissions'

export function isExternalHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

// The renderer is trusted only when it was loaded from the app itself.
function isAppOrigin(url: string, devUrl: string | undefined): boolean {
  if (url.startsWith('file://')) return true
  return devUrl !== undefined && url.startsWith(devUrl)
}

// The camera is for the app. The microphone is too, but only while a skill that listens is open.
// Geolocation, notifications and everything else are denied.
export function setupSessionSecurity(devUrl: string | undefined, microphone: MicrophoneGate): void {
  const ses = session.defaultSession

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(
      mayOpenMedia({
        permission,
        mediaTypes: 'mediaTypes' in details ? details.mediaTypes : undefined,
        fromApp: isAppOrigin(webContents.getURL(), devUrl),
        microphoneOpen: microphone.isOpen
      })
    )
  })

  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    return mayCheckMedia(
      permission,
      isAppOrigin(requestingOrigin, devUrl),
      'mediaType' in details ? details.mediaType : undefined,
      microphone.isOpen
    )
  })
}

export function setupWindowSecurity(
  win: BrowserWindow,
  devUrl: string | undefined,
  microphone: MicrophoneGate
): void {
  // A page that is loaded again has not opened any skill yet.
  win.webContents.on('did-start-loading', () => microphone.set(false))

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpsUrl(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppOrigin(url, devUrl)) event.preventDefault()
  })
}
