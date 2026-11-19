import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountStatus, AuthResult, DeleteAccountResult, SignOutResult } from '@shared/account'
import { FAILURE_TEXT } from './accountErrors'
import {
  applyResult,
  cancelSignOut,
  clearReturnError,
  deleteAccount,
  requestSignOut,
  startAccount,
  useAccount
} from './accountStore'

const SIGNED_IN: AccountStatus = { state: 'signed-in', email: 'ana@mail.com' }

function fakeApi(
  status: AccountStatus | Error = { state: 'signed-out' },
  early: AuthResult | null = null,
  signOutResult: SignOutResult = { done: true, status: { state: 'signed-out' } },
  deleteResult: DeleteAccountResult = { ok: true, status: { state: 'signed-out' } }
): {
  account: {
    status: () => Promise<AccountStatus>
    signOut: (force?: boolean) => Promise<SignOutResult>
    deleteAccount: () => Promise<DeleteAccountResult>
    onResult: (listener: (result: AuthResult) => void) => () => void
    takeReturn: () => Promise<AuthResult | null>
  }
  emit: (result: AuthResult) => void
  stopped: () => boolean
} {
  let listener: ((result: AuthResult) => void) | undefined
  let stopped = false
  return {
    account: {
      status: () => (status instanceof Error ? Promise.reject(status) : Promise.resolve(status)),
      signOut: vi.fn(() => Promise.resolve(signOutResult)),
      deleteAccount: () => Promise.resolve(deleteResult),
      takeReturn: () => Promise.resolve(early),
      onResult: (next) => {
        listener = next
        return () => void (stopped = true)
      }
    },
    emit: (result) => listener?.(result),
    stopped: () => stopped
  }
}

// The store only needs these three calls of the whole api.
const asApi = (api: ReturnType<typeof fakeApi>): Parameters<typeof startAccount>[0] =>
  api as unknown as Parameters<typeof startAccount>[0]

beforeEach(() =>
  useAccount.setState({ status: 'loading', returnError: null, signOutPending: false })
)

describe('startAccount', () => {
  it('starts as loading and then says who is signed in', async () => {
    expect(useAccount.getState().status).toBe('loading')
    await startAccount(asApi(fakeApi(SIGNED_IN)))
    expect(useAccount.getState().status).toEqual(SIGNED_IN)
  })

  it('keeps the door closed when the main process cannot answer', async () => {
    await startAccount(asApi(fakeApi(new Error('no answer'))))
    expect(useAccount.getState().status).toEqual({ state: 'signed-out' })
  })

  it('signs in when the browser comes back from Google', async () => {
    const api = fakeApi()
    await startAccount(asApi(api))
    api.emit({ ok: true, status: SIGNED_IN })
    expect(useAccount.getState().status).toEqual(SIGNED_IN)
  })

  it('keeps a failure of the return for the sign-in screen, until it is cleared', async () => {
    const api = fakeApi()
    await startAccount(asApi(api))
    api.emit({ ok: false, error: 'invalid-code' })
    expect(useAccount.getState()).toMatchObject({
      status: { state: 'signed-out' },
      returnError: 'invalid-code'
    })
    clearReturnError()
    expect(useAccount.getState().returnError).toBeNull()
  })

  it('shows a failed return that came before the page was listening', async () => {
    await startAccount(
      asApi(fakeApi({ state: 'signed-out' }, { ok: false, error: 'invalid-code' }))
    )
    expect(useAccount.getState().returnError).toBe('invalid-code')
  })

  it('stops listening when asked', async () => {
    const api = fakeApi()
    const stop = await startAccount(asApi(api))
    stop()
    expect(api.stopped()).toBe(true)
  })
})

describe('applyResult and signOut', () => {
  it('applies only a result that worked', () => {
    useAccount.setState({ status: { state: 'signed-out' } })
    applyResult({ ok: false, error: 'network' })
    expect(useAccount.getState().status).toEqual({ state: 'signed-out' })
    applyResult({ ok: true, status: SIGNED_IN })
    expect(useAccount.getState().status).toEqual(SIGNED_IN)
  })

  it('goes back to the sign-in page when signing out', async () => {
    useAccount.setState({ status: SIGNED_IN })
    await requestSignOut(asApi(fakeApi()))
    expect(useAccount.getState().status).toEqual({ state: 'signed-out' })
  })

  it('stays signed in and asks when changes are waiting that could not be sent', async () => {
    useAccount.setState({ status: SIGNED_IN })
    await requestSignOut(
      asApi(fakeApi(SIGNED_IN, null, { done: false, reason: 'pending-changes' }))
    )
    expect(useAccount.getState()).toMatchObject({ status: SIGNED_IN, signOutPending: true })

    cancelSignOut()
    expect(useAccount.getState().signOutPending).toBe(false)
  })

  it('signs out anyway when the person says so', async () => {
    useAccount.setState({ status: SIGNED_IN, signOutPending: true })
    const api = fakeApi()
    await requestSignOut(asApi(api), true)
    expect(api.account.signOut).toHaveBeenCalledWith(true)
    expect(useAccount.getState()).toMatchObject({
      status: { state: 'signed-out' },
      signOutPending: false
    })
  })
})

describe('deleteAccount', () => {
  const asDeleteApi = (api: ReturnType<typeof fakeApi>): Parameters<typeof deleteAccount>[0] =>
    ({
      ...api,
      skills: { listCustom: () => Promise.resolve([]) }
    }) as unknown as Parameters<typeof deleteAccount>[0]

  it('goes back to the sign-in page when the account is deleted', async () => {
    useAccount.setState({ status: SIGNED_IN })
    const result = await deleteAccount(asDeleteApi(fakeApi()))
    expect(result.ok).toBe(true)
    expect(useAccount.getState().status).toEqual({ state: 'signed-out' })
  })

  it('stays signed in, and returns the reason, when it could not be deleted', async () => {
    useAccount.setState({ status: SIGNED_IN })
    const api = fakeApi(SIGNED_IN, null, undefined, { ok: false, error: 'network' })
    expect(await deleteAccount(asDeleteApi(api))).toEqual({ ok: false, error: 'network' })
    expect(useAccount.getState().status).toEqual(SIGNED_IN)
  })
})

describe('FAILURE_TEXT', () => {
  it('has a text for every kind of failure', () => {
    const texts = Object.values(FAILURE_TEXT)
    expect(new Set(texts).size).toBe(texts.length)
    expect(Object.keys(FAILURE_TEXT).sort()).toEqual([
      'email-not-confirmed',
      'invalid-code',
      'invalid-credentials',
      'invalid-input',
      'network',
      'rate-limited',
      'unconfigured',
      'unknown',
      'weak-password'
    ])
  })
})
