import { create } from 'zustand'
import type { AccountStatus, AuthFailure, AuthResult, DeleteAccountResult } from '@shared/account'
import type { VyroApi } from '@shared/ipc'
import { resetLocalData } from './localDataStore'
import { loadCustomSkills } from './skillsStore'

// "loading" lasts until the main process says who is signed in (a moment after the window opens).
export type AccountView = 'loading' | AccountStatus

interface AccountState {
  status: AccountView
  // The browser sent the person back from Google with a failure, for the sign-in screen to show.
  returnError: AuthFailure | null
  // Signing out was stopped because changes are waiting to be sent: the person has to choose.
  signOutPending: boolean
}

export const useAccount = create<AccountState>(() => ({
  status: 'loading',
  returnError: null,
  signOutPending: false
}))

type AccountApi = Pick<VyroApi, 'account'>

// What a call returned: when it worked, the account is now the one it says.
export function applyResult(result: AuthResult): void {
  if (result.ok) useAccount.setState({ status: result.status, returnError: null })
}

// Asks who is signed in and keeps the answer up to date: a sign-in that comes back from the
// browser changes it without the person doing anything in the app. Returns how to stop listening.
export async function startAccount(api: AccountApi): Promise<() => void> {
  const stop = api.account.onResult((result) => {
    if (result.ok) applyResult(result)
    else useAccount.setState({ returnError: result.error })
  })
  try {
    useAccount.setState({ status: await api.account.status() })
    // A sign-in that came back before the page was listening.
    const early = await api.account.takeReturn()
    if (early && !early.ok) useAccount.setState({ returnError: early.error })
  } catch {
    // Without an answer nobody is let in: it is the safe side.
    useAccount.setState({ status: { state: 'signed-out' } })
  }
  return stop
}

// Signs out. If changes are waiting that could not be sent, it does not, and asks the person (see
// `signOutPending`); `force` is the answer "sign out anyway".
export async function requestSignOut(api: AccountApi, force = false): Promise<void> {
  const result = await api.account.signOut(force)
  if (!result.done) {
    useAccount.setState({ signOutPending: true })
    return
  }
  useAccount.setState({ status: result.status, signOutPending: false })
  // The next person to sign in is checked again.
  resetLocalData()
}

export function cancelSignOut(): void {
  useAccount.setState({ signOutPending: false })
}

// Erases the account and what it kept, here and in the cloud. The result says if it was not possible.
export async function deleteAccount(
  api: Pick<VyroApi, 'account' | 'skills'>
): Promise<DeleteAccountResult> {
  const result = await api.account.deleteAccount()
  if (result.ok) {
    useAccount.setState({ status: result.status, signOutPending: false })
    resetLocalData()
    // The skills that were made went with the account.
    await loadCustomSkills(api)
  }
  return result
}

export function clearReturnError(): void {
  useAccount.setState({ returnError: null })
}
