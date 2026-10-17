import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionToSave } from '@shared/sessions'
import { openDatabase } from './database'
import { SessionRepository } from './sessionRepository'

const session = (overrides: Partial<SessionToSave> = {}): SessionToSave => ({
  skillId: 'squat',
  startedAt: 1_000,
  durationMs: 60_000,
  score: 75,
  reps: [
    { index: 1, quality: 'good', durationMs: 2500, failedRuleIds: [] },
    { index: 2, quality: 'bad', durationMs: 2300, failedRuleIds: ['depth', 'torso_lean'] },
    { index: 3, quality: 'needs-work', durationMs: 2400, failedRuleIds: ['torso_lean'] }
  ],
  ...overrides
})

let repository: SessionRepository

beforeEach(() => {
  repository = new SessionRepository(openDatabase(':memory:'))
})

describe('SessionRepository', () => {
  it('saves a session and reads it back with its repetitions and errors', () => {
    const id = repository.save(session())

    expect(repository.get(id)).toEqual({
      id,
      skillId: 'squat',
      startedAt: 1_000,
      durationMs: 60_000,
      score: 75,
      repCount: 3,
      goodCount: 1,
      needsWorkCount: 1,
      badCount: 1,
      reps: [
        { id: expect.any(Number), index: 1, quality: 'good', durationMs: 2500, failedRuleIds: [] },
        {
          id: expect.any(Number),
          index: 2,
          quality: 'bad',
          durationMs: 2300,
          failedRuleIds: ['depth', 'torso_lean']
        },
        {
          id: expect.any(Number),
          index: 3,
          quality: 'needs-work',
          durationMs: 2400,
          failedRuleIds: ['torso_lean']
        }
      ]
    })
  })

  it('returns null for a session that does not exist', () => {
    expect(repository.get(404)).toBeNull()
  })

  it('saves a session without repetitions and without a score', () => {
    const id = repository.save(session({ reps: [], score: null }))

    expect(repository.get(id)).toMatchObject({ repCount: 0, goodCount: 0, score: null, reps: [] })
  })

  it('lists the newest session first', () => {
    repository.save(session({ startedAt: 1_000 }))
    repository.save(session({ startedAt: 3_000 }))
    repository.save(session({ startedAt: 2_000 }))

    expect(repository.list().map((row) => row.startedAt)).toEqual([3_000, 2_000, 1_000])
  })

  it('lists the totals of every session without its repetitions', () => {
    repository.save(session())

    expect(repository.list()[0]).toMatchObject({ repCount: 3, goodCount: 1, badCount: 1 })
    expect(repository.list()[0]).not.toHaveProperty('reps')
  })

  it('filters by skill and limits the number of sessions', () => {
    repository.save(session({ skillId: 'squat', startedAt: 1 }))
    repository.save(session({ skillId: 'pushup', startedAt: 2 }))
    repository.save(session({ skillId: 'squat', startedAt: 3 }))

    expect(repository.list({ skillId: 'squat' }).map((row) => row.startedAt)).toEqual([3, 1])
    expect(repository.list({ limit: 1 }).map((row) => row.startedAt)).toEqual([3])
    expect(repository.list({ skillId: 'squat', limit: 1 }).map((row) => row.startedAt)).toEqual([3])
  })

  it('counts the errors, the most frequent first', () => {
    repository.save(session())
    repository.save(session({ skillId: 'pushup' }))

    expect(repository.errorCounts('squat')).toEqual([
      { ruleId: 'torso_lean', count: 2 },
      { ruleId: 'depth', count: 1 }
    ])
    expect(repository.errorCounts()).toEqual([
      { ruleId: 'torso_lean', count: 4 },
      { ruleId: 'depth', count: 2 }
    ])
  })

  it('counts only the errors of the sessions that began after a moment', () => {
    repository.save(session({ startedAt: 1_000 }))
    repository.save(
      session({
        startedAt: 5_000,
        reps: [{ index: 1, quality: 'bad', durationMs: 2000, failedRuleIds: ['depth'] }]
      })
    )

    expect(repository.errorCounts('squat', 2_000)).toEqual([{ ruleId: 'depth', count: 1 }])
    expect(repository.errorCounts(undefined, 2_000)).toEqual([{ ruleId: 'depth', count: 1 }])
    expect(repository.errorCounts('squat', 9_000)).toEqual([])
    // Without a moment, all of them.
    expect(repository.errorCounts('squat')).toEqual([
      { ruleId: 'depth', count: 2 },
      { ruleId: 'torso_lean', count: 2 }
    ])
  })

  it('saves nothing when a repetition cannot be saved', () => {
    const broken = session({
      reps: [
        { index: 1, quality: 'good', durationMs: 2500, failedRuleIds: [] },
        { index: 2, quality: null as never, durationMs: 2300, failedRuleIds: [] }
      ]
    })

    expect(() => repository.save(broken)).toThrow()
    expect(repository.list()).toEqual([])
  })

  it('deletes everything, repetitions and errors included', () => {
    repository.save(session())

    repository.deleteAll()

    expect(repository.list()).toEqual([])
    expect(repository.errorCounts()).toEqual([])
  })
})
