import type { AccountStatus, DeleteAccountResult, SignOutResult, SyncInfo } from '@shared/account'
import type { AuthService } from '../auth/authService'
import type { LocalData } from '../db/localData'
import { SyncError, type AccountCloud } from '../sync/remote'
import type { SyncStatus } from '../sync/syncRunner'

// The sync as these actions need it.
export interface SyncControl {
  hasPending: () => boolean
  run: () => Promise<unknown>
  requestErase: () => void
}

export interface AccountActionsDeps {
  auth: AuthService
  // Null when this build has no cloud to sync with (and under test).
  sync: SyncControl | null
  status: () => SyncStatus
  nudge: () => void
  cloud: AccountCloud | null
  localData: LocalData
  // How long signing out waits for what is pending to go up.
  waitMs?: number
}

const SIGNED_OUT: AccountStatus = { state: 'signed-out' }

// What the person can do about their account from the settings, beyond signing in.
export class AccountActions {
  constructor(private readonly deps: AccountActionsDeps) {}

  syncInfo(): SyncInfo {
    const { sync, status } = this.deps
    if (!sync) return { enabled: false, pending: false, lastSyncAt: null, lastError: null }
    const { lastSyncAt, lastError } = status()
    return { enabled: true, pending: sync.hasPending(), lastSyncAt, lastError }
  }

  // The data of this computer is deleted: the copy in the cloud goes too, now or as soon as there
  // is a connection.
  eraseCloudCopy(): void {
    this.deps.sync?.requestErase()
    this.deps.nudge()
  }

  // Signs out after sending what is waiting. When that cannot be done in a few seconds (no
  // connection), it says so and leaves the person signed in, unless they already chose to go anyway.
  async signOut(force = false): Promise<SignOutResult> {
    const { sync } = this.deps
    if (!force && sync?.hasPending()) {
      await this.sendWhatIsWaiting(sync)
      if (sync.hasPending()) return { done: false, reason: 'pending-changes' }
    }
    return { done: true, status: await this.deps.auth.signOut() }
  }

  // Erases the account in the cloud, and with it everything that was synced, and then forgets it on
  // this computer. It needs a connection: without one nothing is deleted anywhere.
  async deleteAccount(): Promise<DeleteAccountResult> {
    const { cloud, auth, localData } = this.deps
    if (!cloud) return { ok: false, error: 'unconfigured' }
    try {
      await cloud.deleteAccount()
    } catch (error) {
      // Only "no connection" is something the person can fix; the rest is a plain failure.
      const noConnection = error instanceof SyncError && error.kind === 'network'
      return { ok: false, error: noConnection ? 'network' : 'unknown' }
    }
    // The account is gone: its session and its data have nothing to stay for here.
    await auth.signOut()
    localData.wipe()
    localData.release()
    return { ok: true, status: SIGNED_OUT }
  }

  private async sendWhatIsWaiting(sync: SyncControl): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const wait = new Promise<void>((done) => {
      timer = setTimeout(done, this.deps.waitMs ?? 8000)
    })
    // A failure is not an error here: the check afterwards says whether anything is still waiting.
    try {
      await Promise.race([sync.run().catch(() => undefined), wait])
    } finally {
      clearTimeout(timer)
    }
  }
}
