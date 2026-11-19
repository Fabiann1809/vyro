import { resolve } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { findCallbackUrl } from './callback'

const PROTOCOL = 'vyro'

export interface DeepLinks {
  // Starts handing the links to `handler`, including the one that launched the app.
  listen: (handler: (link: string) => void) => void
}

function registerProtocol(): void {
  // In development the app runs as `electron .`, so the system must be told how to start it.
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

function showWindow(): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.focus()
}

// Makes `vyro://` links open this app, and only one copy of it (a second launch hands its link to
// the first). Null when another copy is already running: the caller should quit.
// Call it before the app is ready, because macOS can deliver a link before that.
export function setupDeepLinks(): DeepLinks | null {
  if (!app.requestSingleInstanceLock()) return null
  registerProtocol()

  let handler: ((link: string) => void) | undefined
  const waiting: string[] = []
  const deliver = (link: string): void => {
    if (handler) handler(link)
    else waiting.push(link)
  }

  // Windows and Linux: the link comes as an argument of the second launch.
  app.on('second-instance', (_event, argv) => {
    showWindow()
    const link = findCallbackUrl(argv)
    if (link) deliver(link)
  })
  // macOS: the link comes as an event.
  app.on('open-url', (event, link) => {
    event.preventDefault()
    showWindow()
    deliver(link)
  })

  const launchLink = findCallbackUrl(process.argv)
  if (launchLink) waiting.push(launchLink)

  return {
    listen: (next) => {
      handler = next
      for (const link of waiting.splice(0)) next(link)
    }
  }
}
