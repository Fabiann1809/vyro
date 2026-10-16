import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionToSave } from '@shared/sessions'
import { openDatabase } from '../db/database'
import { SessionRepository } from '../db/sessionRepository'
import { createSessionHandlers } from './sessions'

// The handlers do not need Electron, but the module imports it.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

const valid: SessionToSave = {
  skillId: 'squat',
  startedAt: 1_000,
  durationMs: 60_000,
  score: 100,
  reps: [{ index: 1, quality: 'good', durationMs: 2500, failedRuleIds: [] }]
}

let handlers: ReturnType<typeof createSessionHandlers>

beforeEach(() => {
  handlers = createSessionHandlers(new SessionRepository(openDatabase(':memory:')))
})

describe('session handlers', () => {
  it('saves a session and reads it back', () => {
    const id = handlers.save(valid)

    expect(handlers.get(id)).toMatchObject({ skillId: 'squat', score: 100, repCount: 1 })
    expect(handlers.list(undefined)).toHaveLength(1)
    expect(handlers.errorCounts(undefined)).toEqual([])
  })

  it.each([
    ['a session that is not an object', 'hello'],
    ['an empty skill', { ...valid, skillId: '' }],
    ['a score above 100', { ...valid, score: 101 }],
    ['a negative duration', { ...valid, durationMs: -1 }],
    ['an unknown quality', { ...valid, reps: [{ ...valid.reps[0], quality: 'great' }] }],
    ['an extra field', { ...valid, video: 'data' }],
    ['a fractional repetition number', { ...valid, reps: [{ ...valid.reps[0], index: 1.5 }] }]
  ])('rejects %s', (_name, session) => {
    expect(() => handlers.save(session)).toThrow()
    expect(handlers.list(undefined)).toEqual([])
  })

  it('rejects an invalid query or id', () => {
    expect(() => handlers.list({ limit: 0 })).toThrow()
    expect(() => handlers.list({ other: 1 })).toThrow()
    expect(() => handlers.get('1')).toThrow()
    expect(() => handlers.get(0)).toThrow()
    expect(() => handlers.errorCounts(42)).toThrow()
  })

  it('accepts a valid query', () => {
    handlers.save(valid)

    expect(handlers.list({ skillId: 'squat', limit: 5 })).toHaveLength(1)
    expect(handlers.errorCounts('squat')).toEqual([])
  })
})
