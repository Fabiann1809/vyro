import { describe, expect, it } from 'vitest'
import type { LearningPath, PathStep } from './paths'
import {
  adjustmentProblems,
  adjustmentSchema,
  reviewResultSchema,
  type Adjustment
} from './pathReview'

const skillStep = (id: number, skillId: string, doneAt: number | null = null): PathStep => ({
  id,
  position: id,
  title: `Paso ${id}`,
  description: '',
  kind: 'skill',
  skillId,
  criterionSessions: 3,
  criterionScore: 80,
  doneAt
})

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

// Step 1 is done; 2 is the current one; 3 and 4 are still to come.
const path: LearningPath = {
  id: 1,
  goal: 'Mejorar',
  createdAt: 1_000,
  status: 'active',
  steps: [skillStep(1, 'squat', 5_000), skillStep(2, 'squat'), restStep(3), skillStep(4, 'pushup')]
}
const known = ['squat', 'pushup']

const change = (stepId: number): Adjustment => ({
  type: 'change-criteria',
  stepId,
  criterionSessions: 2,
  criterionScore: 70,
  reason: 'Costó más de lo previsto.'
})
const remove = (stepId: number): Adjustment => ({ type: 'remove-step', stepId, reason: 'Sobra.' })
const add = (afterStepId: number, skillId: string | null = null): Adjustment => ({
  type: 'add-step',
  afterStepId,
  step: skillId
    ? {
        title: 'Más práctica',
        description: '',
        kind: 'skill',
        skillId,
        criterionSessions: 2,
        criterionScore: 70
      }
    : {
        title: 'Descansar',
        description: '',
        kind: 'auxiliary',
        skillId: null,
        criterionSessions: null,
        criterionScore: null
      },
  reason: 'Hace falta recuperarse.'
})

describe('adjustments that can be applied', () => {
  it('accepts a change of goal, a new step and a removal on steps that are not done', () => {
    expect(adjustmentProblems(path, [change(2), add(2, 'squat'), remove(3)], known)).toEqual([])
  })

  it('accepts no adjustments at all', () => {
    expect(adjustmentProblems(path, [], known)).toEqual([])
  })

  it('accepts a step put right after the last one that is done', () => {
    expect(adjustmentProblems(path, [add(1)], known)).toEqual([])
  })
})

describe('adjustments that cannot', () => {
  it('refuses to touch a step that is already done', () => {
    expect(adjustmentProblems(path, [change(1)], known)).toEqual([
      'adjustment 1: step 1 is already done.'
    ])
    expect(adjustmentProblems(path, [remove(1)], known)).toEqual([
      'adjustment 1: step 1 is already done.'
    ])
  })

  it('refuses a step that does not exist', () => {
    expect(adjustmentProblems(path, [change(99)], known)).toEqual([
      'adjustment 1: step 99 does not exist.'
    ])
    expect(adjustmentProblems(path, [add(99)], known)).toEqual([
      'adjustment 1: step 99 does not exist.'
    ])
  })

  it('refuses to add a step before one that is already done', () => {
    const progressed: LearningPath = {
      ...path,
      steps: [
        skillStep(1, 'squat', 5_000),
        restStep(2, 6_000),
        skillStep(3, 'squat'),
        skillStep(4, 'pushup')
      ]
    }

    expect(adjustmentProblems(progressed, [add(1)], known)).toEqual([
      'adjustment 1: a step cannot be added before one that is already done.'
    ])
  })

  it('refuses to change the goal of an auxiliary step', () => {
    expect(adjustmentProblems(path, [change(3)], known)).toEqual([
      'adjustment 1: step 3 is auxiliary and has no goal to change.'
    ])
  })

  it('refuses to change a step twice', () => {
    expect(adjustmentProblems(path, [change(2), remove(2)], known)).toContain(
      'adjustment 2: step 2 is changed twice.'
    )
  })

  it('refuses to add a step after one that is being removed', () => {
    expect(adjustmentProblems(path, [remove(3), add(3)], known)).toContain(
      'adjustment 2: it is put after a step that is being removed.'
    )
  })

  it('refuses a skill that does not exist, and says which ones do', () => {
    expect(adjustmentProblems(path, [add(2, 'yoga_flow')], known)).toEqual([
      'adjustment 1: unknown skill "yoga_flow". Use one of: squat, pushup.'
    ])
  })

  describe('a path with a single skill step to do', () => {
    const fresh: LearningPath = {
      ...path,
      steps: [skillStep(1, 'squat'), restStep(2)]
    }

    it('refuses to leave the path without a skill step', () => {
      expect(adjustmentProblems(fresh, [remove(1)], known)).toEqual([
        'The path would be left with no skill step.'
      ])
    })

    it('counts a skill step that is added when it asks whether one is left', () => {
      expect(adjustmentProblems(fresh, [remove(1), add(2, 'pushup')], known)).toEqual([])
    })
  })

  it('keeps a skill step that is already done as a skill step of the path', () => {
    expect(adjustmentProblems(path, [remove(2), remove(4)], known)).toEqual([])
  })

  it('refuses a path that would grow past the limit', () => {
    const big: LearningPath = {
      ...path,
      steps: Array.from({ length: 30 }, (_, index) => skillStep(index + 1, 'squat'))
    }

    expect(adjustmentProblems(big, [add(30, 'squat')], known)).toContain(
      'The path would have more than 30 steps.'
    )
  })
})

describe('the shape of a review', () => {
  it('accepts a review with and without changes', () => {
    expect(reviewResultSchema.safeParse({ summary: 'Todo bien.', adjustments: [] }).success).toBe(
      true
    )
    expect(
      reviewResultSchema.safeParse({ summary: 'Hay que ajustar.', adjustments: [change(2)] })
        .success
    ).toBe(true)
  })

  it.each([
    ['no summary', { summary: ' ', adjustments: [] }],
    ['more than five changes', { summary: 'x', adjustments: Array(6).fill(change(2)) }],
    ['a change with no reason', { summary: 'x', adjustments: [{ ...change(2), reason: '' }] }],
    ['an unknown kind of change', { summary: 'x', adjustments: [{ type: 'delete-everything' }] }],
    ['a field that is not listed', { summary: 'x', adjustments: [], video: 'y' }]
  ])('rejects %s', (_name, bad) => {
    expect(reviewResultSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a goal out of range', () => {
    expect(adjustmentSchema.safeParse({ ...change(2), criterionScore: 101 }).success).toBe(false)
    expect(adjustmentSchema.safeParse({ ...change(2), criterionSessions: 0 }).success).toBe(false)
  })
})
