import { afterEach, describe, expect, it, vi } from 'vitest'
import { SyncError } from './remote'
import { SyncRunner } from './syncRunner'
import type { SyncReport } from './syncService'

const REPORT: SyncReport = { uploaded: 0, downloaded: 0, deleted: 0, skipped: 0 }
const MINUTE = 60_000

interface State {
  pending: boolean
  canSync: boolean
  failWith: Error | null
  rounds: number
}

function setup(options: Partial<Omit<State, 'rounds'>> = {}): {
  runner: SyncRunner
  clock: { now: number }
  state: State
} {
  const clock = { now: 1_000_000 }
  const state: State = {
    pending: options.pending ?? false,
    canSync: options.canSync ?? true,
    failWith: options.failWith ?? null,
    rounds: 0
  }
  const runner = new SyncRunner({
    now: () => clock.now,
    canSync: async () => state.canSync,
    sync: {
      hasPending: () => state.pending,
      run: async () => {
        state.rounds += 1
        if (state.failWith) throw state.failWith
        state.pending = false
        return REPORT
      }
    }
  })
  return { runner, clock, state }
}

afterEach(() => vi.useRealTimers())

describe('SyncRunner.tick', () => {
  it('does nothing when the account may not sync (signed out, or data of another account)', async () => {
    const { runner, state } = setup({ canSync: false, pending: true })
    await runner.tick()
    expect(state.rounds).toBe(0)
  })

  it('syncs the first time even with nothing to send, to bring down what the cloud has', async () => {
    const { runner, state } = setup()
    await runner.tick()
    expect(state.rounds).toBe(1)
    expect(runner.status()).toMatchObject({
      lastSyncAt: 1_000_000,
      lastError: null,
      running: false
    })
  })

  it('then only syncs when something is waiting, or after five minutes', async () => {
    const { runner, clock, state } = setup()
    await runner.tick()

    clock.now += MINUTE
    await runner.tick()
    expect(state.rounds).toBe(1)

    state.pending = true
    await runner.tick()
    expect(state.rounds).toBe(2)

    clock.now += 4 * MINUTE
    await runner.tick()
    expect(state.rounds).toBe(2)
    clock.now += 2 * MINUTE
    await runner.tick()
    expect(state.rounds).toBe(3)
  })

  it('waits longer after each failure, and says why it failed', async () => {
    const { runner, clock, state } = setup({ failWith: new SyncError('network') })
    await runner.tick()
    expect(state.rounds).toBe(1)
    expect(runner.status().lastError).toBe('network')

    // Too soon: it does not try again.
    clock.now += 30_000
    await runner.tick()
    expect(state.rounds).toBe(1)

    clock.now += MINUTE
    await runner.tick()
    expect(state.rounds).toBe(2)
    // The second wait is longer than the first.
    clock.now += MINUTE
    await runner.tick()
    expect(state.rounds).toBe(2)
  })

  it('never waits more than a quarter of an hour', async () => {
    const { runner, clock, state } = setup({ failWith: new SyncError('network') })
    for (let attempt = 0; attempt < 12; attempt += 1) {
      clock.now += 20 * MINUTE
      await runner.tick()
    }
    expect(state.rounds).toBe(12)
  })

  it('goes back to normal after a round that works', async () => {
    const { runner, clock, state } = setup({ failWith: new SyncError('server') })
    await runner.tick()
    state.failWith = null
    clock.now += 10 * MINUTE
    await runner.tick()
    expect(runner.status().lastError).toBeNull()
    expect(runner.status().lastSyncAt).toBe(clock.now)
  })

  it('treats a failure that is not a sync failure as a server failure, without its text', async () => {
    const { runner } = setup({ failWith: new Error('secret detail') })
    await runner.tick()
    expect(runner.status().lastError).toBe('server')
    expect(JSON.stringify(runner.status())).not.toContain('secret')
  })

  it('does one round at a time', async () => {
    const { runner, state } = setup()
    await Promise.all([runner.tick(), runner.tick(), runner.tick()])
    expect(state.rounds).toBe(1)
  })

  it('does not throw when it cannot tell whether the account may sync', async () => {
    const runner = new SyncRunner({
      canSync: async () => {
        throw new Error('no answer')
      },
      sync: { hasPending: () => true, run: async () => REPORT }
    })
    await expect(runner.tick()).resolves.toBeUndefined()
  })
})

describe('SyncRunner.nudge', () => {
  it('looks right away and forgets the waits of earlier failures', async () => {
    const { runner, state } = setup({ failWith: new SyncError('network') })
    await runner.tick()
    state.failWith = null

    runner.nudge()
    await vi.waitFor(() => expect(state.rounds).toBe(2))
    expect(runner.status().lastError).toBeNull()
  })
})

describe('SyncRunner.start', () => {
  it('looks every thirty seconds until it is stopped', async () => {
    vi.useFakeTimers()
    const { runner, state } = setup({ pending: true })
    runner.start()
    runner.start()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(state.rounds).toBe(1)
    state.pending = true
    await vi.advanceTimersByTimeAsync(30_000)
    expect(state.rounds).toBe(2)

    runner.stop()
    state.pending = true
    await vi.advanceTimersByTimeAsync(120_000)
    expect(state.rounds).toBe(2)
  })
})
