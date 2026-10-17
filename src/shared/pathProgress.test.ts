import { describe, expect, it } from 'vitest'
import type { LearningPath, PathStep } from './paths'
import { evaluatePath } from './pathProgress'
import type { SessionRow } from './sessions'

const CREATED = 1_000

const skillStep = (id: number, skillId: string, overrides: Partial<PathStep> = {}): PathStep =>
  ({
    id,
    position: id,
    title: `Paso ${id}`,
    description: '',
    kind: 'skill',
    skillId,
    criterionSessions: 3,
    criterionScore: 80,
    doneAt: null,
    ...overrides
  }) as PathStep

const restStep = (id: number, doneAt: number | null = null): PathStep => ({
  id,
  position: id,
  title: `Descanso ${id}`,
  description: '',
  kind: 'auxiliary',
  skillId: null,
  criterionSessions: null,
  criterionScore: null,
  doneAt
})

const pathOf = (...steps: PathStep[]): LearningPath => ({
  id: 1,
  goal: 'Mejorar',
  createdAt: CREATED,
  status: 'active',
  steps
})

let nextId = 1
const session = (skillId: string, startedAt: number, score: number | null): SessionRow => ({
  id: nextId++,
  skillId,
  startedAt,
  durationMs: 60_000,
  score,
  repCount: 10,
  goodCount: 8,
  needsWorkCount: 1,
  badCount: 1
})

describe('a step with no data', () => {
  it('is the current one, with nothing counted and nothing tried', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat')), [])

    expect(progress.steps).toEqual([
      {
        stepId: 1,
        state: 'current',
        completedAt: null,
        counted: 0,
        required: 3,
        attempts: 0
      }
    ])
    expect(progress.currentStepId).toBe(1)
    expect(progress.completed).toBe(false)
  })

  it('ignores sessions of other skills', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat')), [session('pushup', 2_000, 95)])

    expect(progress.steps[0]).toMatchObject({ counted: 0, attempts: 0 })
  })
})

describe('a step that is not finished', () => {
  it('counts only the sessions that reach the score', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat')), [
      session('squat', 2_000, 85),
      session('squat', 3_000, 79),
      session('squat', 4_000, 80)
    ])

    expect(progress.steps[0]).toMatchObject({
      state: 'current',
      counted: 2,
      required: 3,
      attempts: 3,
      completedAt: null
    })
  })

  it('tells "tried but not there yet" apart from "not started"', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat')), [session('squat', 2_000, 50)])

    expect(progress.steps[0]).toMatchObject({ counted: 0, attempts: 1 })
  })

  it('does not count a session in which nothing could be judged', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat')), [session('squat', 2_000, null)])

    expect(progress.steps[0]).toMatchObject({ counted: 0, attempts: 0 })
  })

  it('does not count a session from before the path was made', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat')), [
      session('squat', CREATED - 500, 95),
      session('squat', CREATED, 95)
    ])

    expect(progress.steps[0]).toMatchObject({ counted: 0, attempts: 0 })
  })
})

describe('a step that is done', () => {
  const three = [
    session('squat', 2_000, 85),
    session('squat', 3_000, 90),
    session('squat', 4_000, 80)
  ]

  it('is done with the required sessions, and is dated by the one that completed it', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat')), three)

    expect(progress.steps[0]).toMatchObject({ state: 'done', completedAt: 4_000, counted: 3 })
    expect(progress.completed).toBe(true)
    expect(progress.currentStepId).toBeNull()
  })

  it('does not depend on the order in which the sessions are listed', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat')), [...three].reverse())

    expect(progress.steps[0]?.completedAt).toBe(4_000)
  })

  it('needs one session when one is enough', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat', { criterionSessions: 1 })), [
      session('squat', 2_000, 90)
    ])

    expect(progress.steps[0]?.state).toBe('done')
  })

  it('stays done once it has a date, even without the sessions', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat', { doneAt: 5_000 })), [])

    expect(progress.steps[0]).toMatchObject({ state: 'done', completedAt: 5_000 })
  })
})

describe('unlocking the next step', () => {
  it('keeps a step locked until the one before is done', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat'), skillStep(2, 'pushup')), [
      session('pushup', 2_000, 95),
      session('pushup', 3_000, 95),
      session('pushup', 4_000, 95)
    ])

    expect(progress.steps.map((step) => step.state)).toEqual(['current', 'locked'])
    // What was done in a locked step does not count towards it.
    expect(progress.steps[1]).toMatchObject({ counted: 0, attempts: 0 })
    expect(progress.currentStepId).toBe(1)
  })

  it('unlocks the next step when the current one is completed', () => {
    const progress = evaluatePath(pathOf(skillStep(1, 'squat'), skillStep(2, 'pushup')), [
      session('squat', 2_000, 85),
      session('squat', 3_000, 85),
      session('squat', 4_000, 85)
    ])

    expect(progress.steps.map((step) => step.state)).toEqual(['done', 'current'])
    expect(progress.currentStepId).toBe(2)
    expect(progress.completed).toBe(false)
  })

  it('counts, for the next step, only what happens after the previous one was completed', () => {
    const progress = evaluatePath(
      pathOf(
        skillStep(1, 'squat', { criterionSessions: 2 }),
        skillStep(2, 'squat', { criterionSessions: 2 })
      ),
      [
        session('squat', 2_000, 90),
        session('squat', 3_000, 90),
        // These two come after the first step was completed at 3 000.
        session('squat', 4_000, 90),
        session('squat', 5_000, 90)
      ]
    )

    expect(progress.steps.map((step) => step.state)).toEqual(['done', 'done'])
    expect(progress.steps[1]).toMatchObject({ completedAt: 5_000, attempts: 2 })
  })

  it('does not let one old session complete two steps of the same skill', () => {
    const progress = evaluatePath(
      pathOf(
        skillStep(1, 'squat', { criterionSessions: 1 }),
        skillStep(2, 'squat', { criterionSessions: 1 })
      ),
      [session('squat', 2_000, 90)]
    )

    expect(progress.steps.map((step) => step.state)).toEqual(['done', 'current'])
    expect(progress.steps[1]).toMatchObject({ counted: 0, attempts: 0 })
  })

  it('goes through an auxiliary step that was marked done, and waits at one that was not', () => {
    const waiting = evaluatePath(
      pathOf(skillStep(1, 'squat', { doneAt: 3_000 }), restStep(2), skillStep(3, 'pushup')),
      []
    )
    expect(waiting.steps.map((step) => step.state)).toEqual(['done', 'current', 'locked'])
    expect(waiting.steps[1]).toMatchObject({ counted: null, required: null, attempts: null })

    const marked = evaluatePath(
      pathOf(skillStep(1, 'squat', { doneAt: 3_000 }), restStep(2, 4_000), skillStep(3, 'pushup')),
      []
    )
    expect(marked.steps.map((step) => step.state)).toEqual(['done', 'done', 'current'])
  })

  it('counts, after an auxiliary step, only the sessions that come after it was marked', () => {
    const progress = evaluatePath(
      pathOf(restStep(1, 5_000), skillStep(2, 'squat', { criterionSessions: 1 })),
      [session('squat', 4_000, 95), session('squat', 6_000, 95)]
    )

    expect(progress.steps[1]).toMatchObject({ state: 'done', completedAt: 6_000, attempts: 1 })
  })
})

describe('a whole path', () => {
  it('is completed when every step is done', () => {
    const progress = evaluatePath(
      pathOf(skillStep(1, 'squat', { criterionSessions: 1 }), restStep(2, 9_000)),
      [session('squat', 2_000, 90)]
    )

    expect(progress.completed).toBe(true)
    expect(progress.steps.every((step) => step.state === 'done')).toBe(true)
  })

  it('is not completed without steps', () => {
    expect(evaluatePath(pathOf(), []).completed).toBe(false)
  })

  it('follows the order of the positions, not the order it was given', () => {
    const second = skillStep(2, 'pushup')
    const first = skillStep(1, 'squat')

    const progress = evaluatePath(pathOf(second, first), [])

    expect(progress.steps.map((step) => step.stepId)).toEqual([1, 2])
    expect(progress.currentStepId).toBe(1)
  })
})
