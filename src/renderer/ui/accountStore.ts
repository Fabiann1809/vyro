import { create } from 'zustand'
import type { AccountStatus, AuthFailure, AuthResult } from '@shared/account'
import type { VyroApi } from '@shared/ipc'
import { resetLocalData } from './localDataStore'

// "loading" lasts until the main process says who is signed in (a moment after the window opens).
export type AccountView = 'loading' | AccountStatus

interface AccountState {
  status: AccountView
  // The browser sent the person back from Google with a failure, for the sign-in screen to show.
  returnError: AuthFailure | null
}

export const useAccount = create<AccountState>(() => ({ status: 'loading', returnError: null }))

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

export async function signOut(api: AccountApi): Promise<void> {
  useAccount.setState({ status: await api.account.signOut() })
  // The next person to sign in is checked again.
  resetLocalData()
}

export function clearReturnError(): void {
  useAccount.setState({ returnError: null })
}
