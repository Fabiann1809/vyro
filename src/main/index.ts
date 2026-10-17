import { app, BrowserWindow, dialog, safeStorage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { APP_NAME } from '@shared/app'
import icon from '../../resources/icon.png?asset'
import { ApiKeyStore, createKeyFile } from './ai/keyStore'
import { ConfiguredLlmClient } from './ai/provider'
import { SpendLimitedClient } from './ai/spendGuard'
import { AiUsageRepository } from './db/aiUsageRepository'
import { loadReviewSource } from './ai/reviewData'
import { openDatabase, type Database } from './db/database'
import { CustomSkillRepository } from './db/customSkillRepository'
import { PathProgressService } from './db/pathProgressService'
import { PathRepository } from './db/pathRepository'
import { SessionRepository } from './db/sessionRepository'
import { SettingsRepository } from './db/settingsRepository'
import { registerAiIpc } from './ipc/ai'
import { registerCameraIpc } from './ipc/camera'
import { registerMicrophoneIpc } from './ipc/microphone'
import { MicrophoneGate } from './mediaPermissions'
import { registerCoachIpc } from './ipc/coach'
import { registerPathsIpc } from './ipc/paths'
import { registerSessionsIpc } from './ipc/sessions'
import { registerSettingsIpc } from './ipc/settings'
import { registerSkillsIpc } from './ipc/skills'
import { setupSessionSecurity, setupWindowSecurity } from './security'

let database: Database | undefined

const devUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined

// Shared by the window and the permission handlers: whether a skill that listens is open.
const microphone = new MicrophoneGate()

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

  setupWindowSecurity(mainWindow, devUrl, microphone)

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
  setupSessionSecurity(devUrl, microphone)
  registerCameraIpc()
  registerMicrophoneIpc(microphone)
  const sessions = new SessionRepository(database)
  registerSessionsIpc(sessions)
  const keyStore = new ApiKeyStore(
    {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      encryptString: (plain) => safeStorage.encryptString(plain),
      decryptString: (encrypted) => safeStorage.decryptString(encrypted),
      // Linux without a keyring falls back to a fixed key: that is not protection.
      isWeakBackend: () =>
        process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text'
    },
    createKeyFile(join(app.getPath('userData'), 'ai-key.bin'))
  )
  registerAiIpc(keyStore)
  const settings = new SettingsRepository(database)
  const paths = new PathRepository(database)
  const progress = new PathProgressService(paths, sessions)
  const customSkills = new CustomSkillRepository(database)
  registerPathsIpc(paths, progress)
  registerSkillsIpc(customSkills, paths)
  registerSettingsIpc(settings, sessions, paths, customSkills, keyStore)
  registerCoachIpc({
    // The provider and the key are read again on every question, so a change in Settings counts at once.
    llm: new SpendLimitedClient(
      new ConfiguredLlmClient(
        () => settings.getAll(),
        () => keyStore.get()
      ),
      new AiUsageRepository(database),
      () => settings.getAll().aiDailyTokenLimit
    ),
    getSettings: () => settings.getAll(),
    loadReview: () => loadReviewSource(progress, sessions),
    customSkills: {
      usedIds: () => customSkills.list('approved').map((record) => record.id),
      saveDraft: (id, config) => customSkills.replaceDraft(id, config, Date.now())
    }
  })

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
