import { describe, expect, it, vi } from 'vitest'
import { LocalAdoption } from '../db/adoption'
import { openDatabase } from '../db/database'
import { LocalData } from '../db/localData'
import { createLocalDataHandlers } from './localData'

// The handlers do not need Electron, but the module imports it.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

function setup(userId: string | null): {
  handlers: ReturnType<typeof createLocalDataHandlers>
  data: LocalData
  seed: () => void
} {
  const db = openDatabase(':memory:')
  const data = new LocalData(db)
  return {
    handlers: createLocalDataHandlers(new LocalAdoption(data), async () => userId),
    data,
    seed: () =>
      db.exec("INSERT INTO sessions (skill_id, started_at, duration_ms) VALUES ('squat', 1, 1)")
  }
}

describe('local data handlers', () => {
  it('claims an empty computer for the account that signed in', async () => {
    const { handlers, data } = setup('user-1')
    expect(await handlers.check()).toEqual({ action: 'none' })
    expect(data.owner()).toBe('user-1')
  })

  it('asks, and keeps the data when the person says so', async () => {
    const { handlers, data, seed } = setup('user-1')
    seed()
    expect(await handlers.check()).toMatchObject({ action: 'ask' })
    await handlers.resolve({ keep: true })
    expect(data.owner()).toBe('user-1')
    expect(data.counts().sessions).toBe(1)
  })

  it('refuses an answer that is not a clear yes or no', async () => {
    const { handlers, data, seed } = setup('user-1')
    seed()
    for (const choice of [undefined, {}, { keep: 'yes' }, { keep: 1 }, 'keep']) {
      await expect(handlers.resolve(choice)).rejects.toThrow('The choice is not valid.')
    }
    expect(data.owner()).toBeNull()
  })

  it('does nothing when nobody is signed in', async () => {
    const { handlers, data, seed } = setup(null)
    seed()
    await expect(handlers.check()).rejects.toThrow('Nobody is signed in.')
    await expect(handlers.resolve({ keep: false })).rejects.toThrow('Nobody is signed in.')
    expect(data.counts().sessions).toBe(1)
  })
})
