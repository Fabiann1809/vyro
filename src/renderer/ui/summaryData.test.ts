import { describe, expect, it } from 'vitest'
import type { LearningPath, PathStep } from '@shared/paths'
import type { CurrentPath } from '@shared/pathProgress'
import type { SessionRow } from '@shared/sessions'
import { compareWithBefore, stepOutcome } from './summaryData'

const row = (id: number, startedAt: number, score: number | null): SessionRow => ({
  id,
  skillId: 'squat',
  startedAt,
  durationMs: 1000,
  score,
  repCount: 10,
  goodCount: 8,
  needsWorkCount: 1,
  badCount: 1
})

describe('compareWithBefore', () => {
  it('compares with the session just before, not with the one that was just kept', () => {
    const sessions = [row(3, 300, 78), row(2, 200, 71), row(1, 100, 60)]

    expect(compareWithBefore(sessions, 300, 78)).toEqual({ previous: 71, delta: 7, best: true })
  })

  it('says it is not the best when an older session did better', () => {
    const sessions = [row(3, 300, 70), row(2, 200, 60), row(1, 100, 90)]

    expect(compareWithBefore(sessions, 300, 70)).toEqual({ previous: 60, delta: 10, best: false })
  })

  it('sees a worse session as negative', () => {
    expect(compareWithBefore([row(2, 200, 50), row(1, 100, 80)], 200, 50).delta).toBe(-30)
  })

  it('has nothing to compare with the first time', () => {
    expect(compareWithBefore([row(1, 100, 80)], 100, 80)).toEqual({
      previous: null,
      delta: null,
      best: false
    })
  })

  it('skips earlier sessions that had no score', () => {
    expect(compareWithBefore([row(2, 200, 60), row(1, 100, null)], 200, 60).previous).toBeNull()
  })
})

const step = (id: number, position: number, over: Partial<PathStep> = {}): PathStep =>
  ({
    id,
    position,
    title: `Paso ${position}`,
    description: '',
    kind: 'skill',
    skillId: 'squat',
    criterionSessions: 3,
    criterionScore: 80,
    doneAt: null,
    ...over
  }) as PathStep

function current(
  steps: PathStep[],
  progress: Array<{
    stepId: number
    state: 'done' | 'current' | 'locked'
    completedAt?: number
    counted?: number
  }>,
  currentStepId: number | null
): CurrentPath {
  const path: LearningPath = { id: 1, goal: 'Meta', createdAt: 0, status: 'active', steps }
  return {
    path,
    progress: {
      steps: progress.map((item) => ({
        stepId: item.stepId,
        state: item.state,
        completedAt: item.completedAt ?? null,
        counted: item.counted ?? 0,
        required: 3,
        attempts: 1
      })),
      currentStepId,
      completed: false
    }
  }
}

describe('stepOutcome', () => {
  it('has nothing to say without a path', () => {
    expect(stepOutcome(null, 'squat', 100, 90)).toBeNull()
  })

  it('says the step is complete when the session finished it, and what comes next', () => {
    const path = current(
      [step(1, 1), step(2, 2, { skillId: 'pushup' })],
      [
        { stepId: 1, state: 'done', completedAt: 150 },
        { stepId: 2, state: 'current' }
      ],
      2
    )

    const outcome = stepOutcome(path, 'squat', 100, 90)

    expect(outcome).toMatchObject({ kind: 'completed', position: 1 })
    expect(outcome?.kind === 'completed' && outcome.next?.id).toBe(2)
  })

  it('does not take a step finished before the session for this one', () => {
    const path = current([step(1, 1)], [{ stepId: 1, state: 'done', completedAt: 50 }], null)

    expect(stepOutcome(path, 'squat', 100, 90)).toBeNull()
  })

  it('counts a session that reaches the score of the step it is for', () => {
    const path = current([step(1, 1)], [{ stepId: 1, state: 'current', counted: 2 }], 1)

    expect(stepOutcome(path, 'squat', 100, 85)).toEqual({
      kind: 'counted',
      position: 1,
      counted: 2,
      required: 3
    })
  })

  it('does not count a session that falls short of the score', () => {
    const path = current([step(1, 1)], [{ stepId: 1, state: 'current', counted: 0 }], 1)

    expect(stepOutcome(path, 'squat', 100, 70)).toBeNull()
  })

  it('ignores steps of other skills and steps that are still locked', () => {
    const path = current(
      [step(1, 1, { skillId: 'pushup' }), step(2, 2)],
      [
        { stepId: 1, state: 'current' },
        { stepId: 2, state: 'locked' }
      ],
      1
    )

    expect(stepOutcome(path, 'squat', 100, 95)).toBeNull()
  })
})
