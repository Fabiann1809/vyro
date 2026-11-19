import { app, BrowserWindow, dialog, safeStorage, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { APP_NAME } from '@shared/app'
import icon from '../../resources/icon.png?asset'
import { ApiKeyStore, createKeyFile, type SecretStorage } from './ai/keyStore'
import { AuthService } from './auth/authService'
import { mayOpenInBrowser } from './auth/browser'
import { setupDeepLinks } from './auth/deepLinks'
import { ReturnInbox } from './auth/returnInbox'
import { readAuthConfig } from './auth/config'
import { EncryptedAuthStorage } from './auth/sessionStorage'
import { createSupabaseClient, createSupabaseGateway } from './auth/supabaseGateway'
import { AccountActions } from './account/accountActions'
import { registerAccountIpc } from './ipc/account'
import { ConfiguredLlmClient } from './ai/provider'
import { dayOf, SpendLimitedClient } from './ai/spendGuard'
import { AiUsageRepository } from './db/aiUsageRepository'
import { loadReviewSource } from './ai/reviewData'
import { LocalAdoption } from './db/adoption'
import { openDatabase, type Database } from './db/database'
import { LocalData } from './db/localData'
import { CustomSkillRepository } from './db/customSkillRepository'
import { PathProgressService } from './db/pathProgressService'
import { PathRepository } from './db/pathRepository'
import { SessionRepository } from './db/sessionRepository'
import { SettingsRepository } from './db/settingsRepository'
import { registerAiIpc } from './ipc/ai'
import { registerCameraIpc } from './ipc/camera'
import { registerLocalDataIpc } from './ipc/localData'
import type { AccountCloud, RemoteStore } from './sync/remote'
import { createSupabaseAccountCloud, createSupabaseRemote } from './sync/supabaseRemote'
import { SyncRunner } from './sync/syncRunner'
import { SyncService } from './sync/syncService'
import { registerMicrophoneIpc } from './ipc/microphone'
import { MicrophoneGate } from './mediaPermissions'
import { registerCoachIpc } from './ipc/coach'
import { registerPathsIpc } from './ipc/paths'
import { registerSessionsIpc } from './ipc/sessions'
import { registerSettingsIpc } from './ipc/settings'
import { registerSkillsIpc } from './ipc/skills'
import { setupSessionSecurity, setupWindowSecurity } from './security'
import { IPC } from '@shared/ipc'

let database: Database | undefined
// Stops the background sync when the app quits.
let stopSync: (() => void) | undefined

const devUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined

// Shared by the window and the permission handlers: whether a skill that listens is open.
const microphone = new MicrophoneGate()

const secretStorage: SecretStorage = {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (plain) => safeStorage.encryptString(plain),
  decryptString: (encrypted) => safeStorage.decryptString(encrypted),
  // Linux without a keyring falls back to a fixed key: that is not protection.
  isWeakBackend: () =>
    process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text'
}

// The tests of the app run it from source and give it a fake sign-in server on this computer. A
// packaged app ignores this, so nobody can point an installed VYRO at another server.
const testServer = app.isPackaged ? undefined : process.env['VYRO_E2E_SUPABASE_URL']

interface Account {
  auth: AuthService
  // The cloud of the account, or null when this build has no account service or is under test.
  remote: RemoteStore | null
  // What can be done to the account itself (delete it). Also there under test, where the fake
  // server answers it.
  cloud: AccountCloud | null
}

function createAccount(): Account {
  // Written out one by one so the build can replace each value.
  const config = testServer
    ? readAuthConfig(
        {
          MAIN_VITE_SUPABASE_URL: testServer,
          MAIN_VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test'
        },
        { allowLoopbackHttp: true }
      )
    : readAuthConfig({
        MAIN_VITE_SUPABASE_URL: import.meta.env.MAIN_VITE_SUPABASE_URL,
        MAIN_VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.MAIN_VITE_SUPABASE_PUBLISHABLE_KEY
      })
  if (!config) return { auth: new AuthService(null), remote: null, cloud: null }
  const openBrowser = async (url: string): Promise<boolean> => {
    if (!mayOpenInBrowser(url, testServer !== undefined)) return false
    // Under test no browser is opened: the test brings the return link itself.
    if (!testServer) await shell.openExternal(url)
    return true
  }
  const storage = new EncryptedAuthStorage(
    secretStorage,
    createKeyFile(join(app.getPath('userData'), 'account-session.bin'))
  )
  const client = createSupabaseClient(config, storage)
  return {
    auth: new AuthService(createSupabaseGateway(client, config, storage), openBrowser),
    // The tests of the app have no cloud to sync with: the fake server only signs people in.
    remote: testServer ? null : createSupabaseRemote(client),
    cloud: createSupabaseAccountCloud(client)
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon,
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

// Before the app is ready: macOS can deliver the return link of a sign-in before that.
const deepLinks = setupDeepLinks()
if (!deepLinks) app.quit()

app.whenReady().then(() => {
  if (!deepLinks) return
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
  const { auth, remote, cloud } = createAccount()
  const inbox = new ReturnInbox()
  const localData = new LocalData(database)
  const syncService = remote ? new SyncService(database, remote) : null
  const syncRunner = syncService
    ? new SyncRunner({
        sync: syncService,
        // Only an account that is signed in and owns the data here may sync it.
        canSync: async () => {
          const id = await auth.currentUserId()
          return id !== null && localData.owner() === id
        }
      })
    : null
  syncRunner?.start()
  stopSync = () => syncRunner?.stop()
  const accountActions = new AccountActions({
    auth,
    sync: syncService,
    status: () => syncRunner?.status() ?? { running: false, lastSyncAt: null, lastError: null },
    nudge: () => syncRunner?.nudge(),
    cloud,
    localData
  })
  registerAccountIpc(auth, inbox, accountActions)
  registerLocalDataIpc(
    new LocalAdoption(localData),
    () => auth.currentUserId(),
    // The data is this account's now: bring it up to date without waiting for the timer.
    () => syncRunner?.nudge()
  )
  deepLinks.listen(async (link) => {
    const result = await auth.handleCallback(link)
    if (!result) return
    // The page may not be listening yet (the browser can open the app with the link).
    inbox.put(result)
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC.accountResult, result)
    }
  })
  registerCameraIpc()
  registerMicrophoneIpc(microphone)
  const sessions = new SessionRepository(database)
  registerSessionsIpc(sessions)
  const keyStore = new ApiKeyStore(
    secretStorage,
    createKeyFile(join(app.getPath('userData'), 'ai-key.bin'))
  )
  const aiUsage = new AiUsageRepository(database)
  registerAiIpc(keyStore, { tokensToday: () => aiUsage.tokensOn(dayOf(Date.now())) })
  const settings = new SettingsRepository(database)
  const paths = new PathRepository(database)
  const progress = new PathProgressService(paths, sessions)
  const customSkills = new CustomSkillRepository(database)
  registerPathsIpc(paths, progress)
  registerSkillsIpc(customSkills, paths)
  // Deleting all the data of this computer deletes the copy in the cloud too.
  registerSettingsIpc(settings, sessions, paths, customSkills, keyStore, () =>
    accountActions.eraseCloudCopy()
  )
  registerCoachIpc({
    // The provider and the key are read again on every question, so a change in Settings counts at once.
    llm: new SpendLimitedClient(
      new ConfiguredLlmClient(
        () => settings.getAll(),
        () => keyStore.get()
      ),
      aiUsage,
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

app.on('will-quit', () => {
  stopSync?.()
  database?.close()
})

// Quit when all windows are closed, except on macOS where apps stay active until Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
