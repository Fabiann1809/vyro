import { beforeEach, describe, expect, it } from 'vitest'
import type { AccountStatus, AuthResult } from '@shared/account'
import { FAILURE_TEXT } from './accountErrors'
import { applyResult, clearReturnError, signOut, startAccount, useAccount } from './accountStore'

const SIGNED_IN: AccountStatus = { state: 'signed-in', email: 'ana@mail.com' }

function fakeApi(
  status: AccountStatus | Error = { state: 'signed-out' },
  early: AuthResult | null = null
): {
  account: {
    status: () => Promise<AccountStatus>
    signOut: () => Promise<AccountStatus>
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
      signOut: () => Promise.resolve({ state: 'signed-out' }),
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

beforeEach(() => useAccount.setState({ status: 'loading', returnError: null }))

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
    await signOut(asApi(fakeApi()))
    expect(useAccount.getState().status).toEqual({ state: 'signed-out' })
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
