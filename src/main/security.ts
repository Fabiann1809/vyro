import { session, shell, type BrowserWindow } from 'electron'

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

// Only the camera is ever requested. Microphone, geolocation, notifications, etc. are denied.
export function setupSessionSecurity(devUrl: string | undefined): void {
  const ses = session.defaultSession

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const isCamera =
      permission === 'media' &&
      'mediaTypes' in details &&
      details.mediaTypes?.every((type) => type === 'video') === true
    callback(isCamera && isAppOrigin(webContents.getURL(), devUrl))
  })

  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return permission === 'media' && isAppOrigin(requestingOrigin, devUrl)
  })
}

export function setupWindowSecurity(win: BrowserWindow, devUrl: string | undefined): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpsUrl(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppOrigin(url, devUrl)) event.preventDefault()
  })
}
