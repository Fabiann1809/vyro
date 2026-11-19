import { ipcMain } from 'electron'
import type { AccountStatus, AuthResult } from '@shared/account'
import { IPC } from '@shared/ipc'
import type { AuthService } from '../auth/authService'

// What each channel does, apart from Electron so it can be tested. The page sends an address and a
// password and gets back who is signed in or a kind of failure; tokens never reach it.
export function createAccountHandlers(auth: AuthService): {
  status: () => Promise<AccountStatus>
  signIn: (input: unknown) => Promise<AuthResult>
  signOut: () => Promise<AccountStatus>
} {
  return {
    status: () => auth.status(),
    signIn: (input) => auth.signIn(input),
    signOut: () => auth.signOut()
  }
}

export function registerAccountIpc(auth: AuthService): void {
  const handlers = createAccountHandlers(auth)

  ipcMain.handle(IPC.accountStatus, () => handlers.status())
  ipcMain.handle(IPC.accountSignIn, (_event, input: unknown) => handlers.signIn(input))
  ipcMain.handle(IPC.accountSignOut, () => handlers.signOut())
}
