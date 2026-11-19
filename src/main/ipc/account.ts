import { ipcMain } from 'electron'
import type { AccountStatus, AuthResult } from '@shared/account'
import { IPC } from '@shared/ipc'
import type { AuthService } from '../auth/authService'

type Handler = (input: unknown) => Promise<AuthResult>

// What each channel does, apart from Electron so it can be tested. The page sends an address and a
// password or a code and gets back who is signed in or a kind of failure; tokens never reach it.
export function createAccountHandlers(auth: AuthService): {
  status: () => Promise<AccountStatus>
  signIn: Handler
  signUp: Handler
  verifyEmailCode: Handler
  requestPasswordReset: Handler
  resetPassword: Handler
  signOut: () => Promise<AccountStatus>
} {
  return {
    status: () => auth.status(),
    signIn: (input) => auth.signIn(input),
    signUp: (input) => auth.signUp(input),
    verifyEmailCode: (input) => auth.verifyEmailCode(input),
    requestPasswordReset: (input) => auth.requestPasswordReset(input),
    resetPassword: (input) => auth.resetPassword(input),
    signOut: () => auth.signOut()
  }
}

export function registerAccountIpc(auth: AuthService): void {
  const handlers = createAccountHandlers(auth)

  ipcMain.handle(IPC.accountStatus, () => handlers.status())
  ipcMain.handle(IPC.accountSignIn, (_event, input: unknown) => handlers.signIn(input))
  ipcMain.handle(IPC.accountSignUp, (_event, input: unknown) => handlers.signUp(input))
  ipcMain.handle(IPC.accountVerifyEmailCode, (_event, input: unknown) =>
    handlers.verifyEmailCode(input)
  )
  ipcMain.handle(IPC.accountRequestPasswordReset, (_event, input: unknown) =>
    handlers.requestPasswordReset(input)
  )
  ipcMain.handle(IPC.accountResetPassword, (_event, input: unknown) =>
    handlers.resetPassword(input)
  )
  ipcMain.handle(IPC.accountSignOut, () => handlers.signOut())
}
