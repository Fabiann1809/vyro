import { describe, expect, it, vi } from 'vitest'
import { AuthService, type AuthGateway } from '../auth/authService'
import { openDatabase } from '../db/database'
import { LocalData } from '../db/localData'
import { SyncError, type AccountCloud } from '../sync/remote'
import type { SyncStatus } from '../sync/syncRunner'
import { AccountActions, type SyncControl } from './accountActions'

function gateway(signedOut: { value: boolean }): AuthGateway {
  const unused = async (): Promise<never> => {
    throw new Error('not used')
  }
  return {
    currentUser: async () => ({ email: 'ana@mail.com', id: 'user-1' }),
    signInWithPassword: unused,
    signUp: unused,
    verifyEmailCode: unused,
    requestPasswordReset: unused,
    resetPassword: unused,
    startGoogleSignIn: unused,
    completeSignIn: unused,
    signOut: async () => void (signedOut.value = true)
  }
}

interface Setup {
  actions: AccountActions
  signedOut: { value: boolean }
  sync: SyncControl & { pending: boolean; run: ReturnType<typeof vi.fn> }
  data: LocalData
  deleted: { account: number }
  nudges: { count: number }
}

function setup(
  options: {
    pending?: boolean
    runFails?: boolean
    runHangs?: boolean
    cloudFails?: Error
    hasSync?: boolean
    lastError?: SyncStatus['lastError']
  } = {}
): Setup {
  const signedOut = { value: false }
  const deleted = { account: 0 }
  const nudges = { count: 0 }
  const db = openDatabase(':memory:')
  const data = new LocalData(db)
  data.claim('user-1', 1)
  db.exec("INSERT INTO sessions (skill_id, started_at, duration_ms) VALUES ('squat', 1, 1)")

  const sync = {
    pending: options.pending ?? false,
    hasPending() {
      return this.pending
    },
    run: vi.fn(async () => {
      if (options.runHangs) return new Promise<never>(() => {})
      if (options.runFails) throw new SyncError('network')
      sync.pending = false
    }),
    requestErase: vi.fn()
  }
  const cloud: AccountCloud = {
    deleteAccount: async () => {
      if (options.cloudFails) throw options.cloudFails
      deleted.account += 1
    }
  }
  const actions = new AccountActions({
    auth: new AuthService(gateway(signedOut)),
    sync: options.hasSync === false ? null : sync,
    status: () => ({ running: false, lastSyncAt: 5000, lastError: options.lastError ?? null }),
    nudge: () => void (nudges.count += 1),
    cloud,
    localData: data,
    waitMs: 20
  })
  return { actions, signedOut, sync, data, deleted, nudges }
}

describe('AccountActions.signOut', () => {
  it('signs out at once when nothing is waiting', async () => {
    const { actions, signedOut, sync } = setup()
    expect(await actions.signOut()).toEqual({ done: true, status: { state: 'signed-out' } })
    expect(signedOut.value).toBe(true)
    expect(sync.run).not.toHaveBeenCalled()
  })

  it('sends what is waiting before it signs out', async () => {
    const { actions, signedOut, sync } = setup({ pending: true })
    expect(await actions.signOut()).toMatchObject({ done: true })
    expect(sync.run).toHaveBeenCalledOnce()
    expect(signedOut.value).toBe(true)
  })

  it('stays signed in, and says why, when what is waiting cannot be sent', async () => {
    const { actions, signedOut } = setup({ pending: true, runFails: true })
    expect(await actions.signOut()).toEqual({ done: false, reason: 'pending-changes' })
    expect(signedOut.value).toBe(false)
  })

  it('does not wait for ever when the cloud does not answer', async () => {
    const { actions, signedOut } = setup({ pending: true, runHangs: true })
    expect(await actions.signOut()).toEqual({ done: false, reason: 'pending-changes' })
    expect(signedOut.value).toBe(false)
  })

  it('signs out anyway when the person chose to, without trying to send', async () => {
    const { actions, signedOut, sync } = setup({ pending: true, runFails: true })
    expect(await actions.signOut(true)).toMatchObject({ done: true })
    expect(signedOut.value).toBe(true)
    expect(sync.run).not.toHaveBeenCalled()
  })

  it('signs out at once when there is no cloud to sync with', async () => {
    const { actions, signedOut } = setup({ hasSync: false })
    expect(await actions.signOut()).toMatchObject({ done: true })
    expect(signedOut.value).toBe(true)
  })
})

describe('AccountActions.deleteAccount', () => {
  it('deletes the account in the cloud, signs out and forgets the data here', async () => {
    const { actions, signedOut, data, deleted } = setup()
    expect(await actions.deleteAccount()).toEqual({ ok: true, status: { state: 'signed-out' } })
    expect(deleted.account).toBe(1)
    expect(signedOut.value).toBe(true)
    expect(data.isEmpty()).toBe(true)
    expect(data.owner()).toBeNull()
  })

  it('deletes nothing here when the cloud could not be reached', async () => {
    const { actions, signedOut, data } = setup({ cloudFails: new SyncError('network') })
    expect(await actions.deleteAccount()).toEqual({ ok: false, error: 'network' })
    expect(signedOut.value).toBe(false)
    expect(data.isEmpty()).toBe(false)
    expect(data.owner()).toBe('user-1')
  })

  it('reports any other failure without its text', async () => {
    const { actions, data } = setup({ cloudFails: new Error('secret detail') })
    const result = await actions.deleteAccount()
    expect(result).toEqual({ ok: false, error: 'unknown' })
    expect(JSON.stringify(result)).not.toContain('secret')
    expect(data.isEmpty()).toBe(false)
  })
})

describe('AccountActions.syncInfo and eraseCloudCopy', () => {
  it('says how the sync is doing', () => {
    const { actions } = setup({ pending: true, lastError: 'network' })
    expect(actions.syncInfo()).toEqual({
      enabled: true,
      pending: true,
      lastSyncAt: 5000,
      lastError: 'network'
    })
  })

  it('says that there is no sync when the build has no cloud', () => {
    expect(setup({ hasSync: false }).actions.syncInfo()).toEqual({
      enabled: false,
      pending: false,
      lastSyncAt: null,
      lastError: null
    })
  })

  it('asks the sync to erase the cloud copy and to look right away', () => {
    const { actions, sync, nudges } = setup()
    actions.eraseCloudCopy()
    expect(sync.requestErase).toHaveBeenCalledOnce()
    expect(nudges.count).toBe(1)
  })
})
