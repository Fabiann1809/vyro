import { describe, expect, it } from 'vitest'
import type { SyncInfo } from '@shared/account'
import { syncLine } from './syncText'

const BASE: SyncInfo = { enabled: true, pending: false, lastSyncAt: null, lastError: null }

describe('syncLine', () => {
  it('says that there is no sync when the build has no cloud', () => {
    expect(syncLine({ ...BASE, enabled: false, pending: true })).toEqual({
      key: 'account.sync.off'
    })
  })

  it('says nothing was synced yet', () => {
    expect(syncLine(BASE)).toEqual({ key: 'account.sync.never' })
  })

  it('says there are changes to upload', () => {
    expect(syncLine({ ...BASE, pending: true, lastSyncAt: 1000 })).toEqual({
      key: 'account.sync.pending'
    })
  })

  it('shows a failure before anything else, because it is why something is waiting', () => {
    expect(syncLine({ ...BASE, pending: true, lastError: 'network' })).toEqual({
      key: 'account.sync.error.network'
    })
    expect(syncLine({ ...BASE, lastError: 'auth' })).toEqual({ key: 'account.sync.error.auth' })
    expect(syncLine({ ...BASE, lastError: 'server' })).toEqual({
      key: 'account.sync.error.server'
    })
  })

  it('gives the time of the last sync when everything is up to date', () => {
    const line = syncLine({ ...BASE, lastSyncAt: new Date(2026, 10, 19, 9, 5).getTime() })
    expect(line.key).toBe('account.sync.synced')
    expect(line.params?.time).toMatch(/9|09/)
  })
})
