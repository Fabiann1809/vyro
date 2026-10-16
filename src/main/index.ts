import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { APP_NAME } from '@shared/app'
import icon from '../../resources/icon.png?asset'
import { openDatabase, type Database } from './db/database'
import { registerCameraIpc } from './ipc/camera'
import { setupSessionSecurity, setupWindowSecurity } from './security'

let database: Database | undefined

const devUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    title: APP_NAME,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  setupWindowSecurity(mainWindow, devUrl)

  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('io.github.fabiann1809.vyro')

  try {
    database = openDatabase(join(app.getPath('userData'), 'vyro.db'))
  } catch (error) {
    // Better to stop with a clear message than to run without being able to save anything.
    dialog.showErrorBox(APP_NAME, error instanceof Error ? error.message : String(error))
    app.quit()
    return
  }
  setupSessionSecurity(devUrl)
  registerCameraIpc()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => database?.close())

// Quit when all windows are closed, except on macOS where apps stay active until Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
