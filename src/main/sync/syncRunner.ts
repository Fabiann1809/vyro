import { SyncError, type SyncFailure } from './remote'
import type { SyncReport } from './syncService'

// How often the runner looks at whether there is anything to do.
const TICK_MS = 30_000
// A computer with nothing to send still asks the cloud for news this often.
const PULL_EVERY_MS = 5 * 60_000
const MAX_BACKOFF_MS = 15 * 60_000

export interface SyncStatus {
  running: boolean
  // When the last round finished well, or null if none has yet.
  lastSyncAt: number | null
  // Why the last round failed, or null if it did not.
  lastError: SyncFailure | null
}

export interface SyncRunnerDeps {
  sync: { hasPending: () => boolean; run: () => Promise<SyncReport> }
  // Whether this account may sync now: it is signed in and the data on this computer is its own.
  canSync: () => Promise<boolean>
  now?: () => number
}

// Runs the sync in the background and never in the way: it works on a timer, one round at a time,
// and after a failure it waits longer each time (a computer with no connection is not asked to try
// every few seconds). Practising never waits for it.
export class SyncRunner {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  // A look is going on, whether it is still deciding or already syncing.
  private busy = false
  private lastSyncAt: number | null = null
  private lastError: SyncFailure | null = null
  private failures = 0
  private nextAttemptAt = 0
  private readonly now: () => number

  constructor(private readonly deps: SyncRunnerDeps) {
    this.now = deps.now ?? Date.now
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), TICK_MS)
    // Not the thing that keeps the app open.
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  status(): SyncStatus {
    return { running: this.running, lastSyncAt: this.lastSyncAt, lastError: this.lastError }
  }

  // Something just changed the picture (the person signed in and the data is theirs): look now.
  nudge(): void {
    this.failures = 0
    this.nextAttemptAt = 0
    void this.tick()
  }

  // One look: does a round, if there is a reason to and it is the moment. Never throws. A look that
  // is made while another is still going on does nothing: the guard is taken before the first wait.
  async tick(): Promise<void> {
    if (this.busy || this.now() < this.nextAttemptAt) return
    this.busy = true
    try {
      if (!(await this.due())) return
      this.running = true
      try {
        await this.deps.sync.run()
        this.lastSyncAt = this.now()
        this.lastError = null
        this.failures = 0
      } catch (error) {
        this.failures += 1
        this.lastError = error instanceof SyncError ? error.kind : 'server'
        this.nextAttemptAt = this.now() + Math.min(MAX_BACKOFF_MS, TICK_MS * 2 ** this.failures)
      } finally {
        this.running = false
      }
    } finally {
      this.busy = false
    }
  }

  // Whether there is a reason to sync now: this account may, and it is the first time, there is
  // something waiting, or it has been a while.
  private async due(): Promise<boolean> {
    try {
      if (!(await this.deps.canSync())) return false
      if (this.lastSyncAt === null) return true
      if (this.now() - this.lastSyncAt >= PULL_EVERY_MS) return true
      return this.deps.sync.hasPending()
    } catch {
      return false
    }
  }
}
