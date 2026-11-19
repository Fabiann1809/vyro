import type { SyncFailureKind } from '@shared/account'
import type { RemoteRow, SyncTable } from './tables'

// A failure of the cloud, as a fixed kind: what the server says is never kept, shown or logged.
export type SyncFailure = SyncFailureKind

export class SyncError extends Error {
  constructor(readonly kind: SyncFailure) {
    super(`The sync failed (${kind}).`)
    this.name = 'SyncError'
  }
}

// The part of the cloud that the sync talks to, so that it can be tested without a network. Every
// call is made as the signed-in person, and the cloud only lets them see and change their own rows.
export interface RemoteStore {
  // Creates the rows or replaces the ones that have the same id.
  upsert: (table: SyncTable, rows: RemoteRow[]) => Promise<void>
  // The rows changed at or after `since` (milliseconds), oldest first, at most `limit`.
  changedSince: (table: SyncTable, since: number, limit: number) => Promise<unknown[]>
  // Marks the rows with these ids as deleted at `at` (milliseconds). They are not erased: the other
  // computers learn about the delete when they download them. Ids that are not there are not an error.
  remove: (table: SyncTable, ids: string[], at: number) => Promise<void>
  // Erases, for good, everything that the account has synced. The account itself stays.
  eraseAll: () => Promise<void>
}

// What can be done to the account itself, apart from syncing.
export interface AccountCloud {
  // Erases the account and everything of it. Needs a connection and cannot be undone.
  deleteAccount: () => Promise<void>
}
