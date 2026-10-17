import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PathToSave } from '@shared/paths'
import { openDatabase } from '../db/database'
import { PathProgressService } from '../db/pathProgressService'
import { PathRepository } from '../db/pathRepository'
import { SessionRepository } from '../db/sessionRepository'
import { createPathHandlers } from './paths'

// The handlers do not need Electron, but the module imports it.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

const path = (goal = 'Mejorar mi sentadilla'): PathToSave => ({
  goal,
  steps: [
    {
      title: 'Descansar',
      description: '',
      kind: 'auxiliary',
      skillId: null,
      criterionSessions: null,
      criterionScore: null
    },
    {
      title: 'Sentadilla lenta',
      description: 'Baja en tres segundos.',
      kind: 'skill',
      skillId: 'squat',
      criterionSessions: 3,
      criterionScore: 75
    }
  ]
})

let handlers: ReturnType<typeof createPathHandlers>
let repository: PathRepository

beforeEach(() => {
  const db = openDatabase(':memory:')
  repository = new PathRepository(db)
  handlers = createPathHandlers(
    repository,
    new PathProgressService(repository, new SessionRepository(db))
  )
})

describe('path handlers', () => {
  it('has no current path to begin with', () => {
    expect(handlers.getCurrent()).toBeNull()
  })

  it('saves a path and gives it back as the current one, with its progress', () => {
    const id = handlers.save(path())

    const current = handlers.getCurrent()
    expect(current?.path).toMatchObject({ id, goal: 'Mejorar mi sentadilla', status: 'active' })
    expect(current?.progress.steps.map((step) => step.state)).toEqual(['current', 'locked'])
  })

  it('sets the date itself, not the page', () => {
    const before = Date.now()
    handlers.save(path())
    const after = Date.now()

    const createdAt = handlers.getCurrent()?.path.createdAt ?? 0
    expect(createdAt).toBeGreaterThanOrEqual(before)
    expect(createdAt).toBeLessThanOrEqual(after)
  })

  it('follows one path at a time: a new one archives the previous', () => {
    const first = handlers.save(path('Primera'))
    const second = handlers.save(path('Segunda'))

    expect(handlers.getCurrent()?.path.id).toBe(second)
    expect(repository.get(first)?.status).toBe('archived')
  })

  it.each([
    ['something that is not a path', 'hola'],
    ['a path without steps', { goal: 'x', steps: [] }],
    ['a field that is not listed', { ...path(), video: 'x' }],
    [
      'a skill step without its skill',
      { goal: 'x', steps: [{ ...path().steps[1], skillId: null }] }
    ]
  ])('rejects %s, and saves nothing', (_name, bad) => {
    expect(() => handlers.save(bad)).toThrow()
    expect(repository.list()).toEqual([])
  })

  it('marks the first auxiliary step done and unlocks the next one', () => {
    handlers.save(path())
    const rest = handlers.getCurrent()?.path.steps[0]?.id ?? 0

    expect(handlers.setStepDone(rest, true)).toBe(true)

    const current = handlers.getCurrent()
    expect(current?.path.steps[0]?.doneAt).toEqual(expect.any(Number))
    expect(current?.progress.steps.map((step) => step.state)).toEqual(['done', 'current'])
  })

  it('unmarks a step', () => {
    handlers.save(path())
    const rest = handlers.getCurrent()?.path.steps[0]?.id ?? 0
    handlers.setStepDone(rest, true)

    expect(handlers.setStepDone(rest, false)).toBe(true)

    expect(handlers.getCurrent()?.path.steps[0]?.doneAt).toBeNull()
  })

  it('says so when the step does not exist', () => {
    expect(handlers.setStepDone(404, true)).toBe(false)
    expect(handlers.archive(404)).toBe(false)
  })

  it('archives a path, which is then no longer the current one', () => {
    const id = handlers.save(path())

    expect(handlers.archive(id)).toBe(true)

    expect(handlers.getCurrent()).toBeNull()
  })

  it.each([
    ['an id that is not a number', '1', true],
    ['an id below 1', 0, true],
    ['a fractional id', 1.5, true],
    ['a "done" that is not a boolean', 1, 'yes']
  ])('rejects %s', (_name, id, done) => {
    expect(() => handlers.setStepDone(id, done)).toThrow()
  })
})

describe('applying the adjustments that were accepted', () => {
  const known = ['squat', 'pushup']
  const stepIds = (): number[] => handlers.getCurrent()?.path.steps.map((step) => step.id) ?? []

  it('applies them and the path changes', () => {
    const pathId = handlers.save(path())
    const [rest, skill] = stepIds()

    const applied = handlers.applyAdjustments({
      pathId,
      skillIds: known,
      adjustments: [
        {
          type: 'change-criteria',
          stepId: skill,
          criterionSessions: 5,
          criterionScore: 60,
          reason: 'Más práctica.'
        },
        {
          type: 'add-step',
          afterStepId: rest,
          step: {
            title: 'Descanso extra',
            description: '',
            kind: 'auxiliary',
            skillId: null,
            criterionSessions: null,
            criterionScore: null
          },
          reason: 'Recuperarse.'
        }
      ]
    })

    expect(applied).toBe(true)
    const steps = handlers.getCurrent()?.path.steps ?? []
    expect(steps.map((step) => step.title)).toEqual([
      'Descansar',
      'Descanso extra',
      'Sentadilla lenta'
    ])
    expect(steps[2]).toMatchObject({ criterionSessions: 5, criterionScore: 60 })
  })

  it('does not change a step that is already done, and changes nothing', () => {
    const pathId = handlers.save(path())
    const [rest, skill] = stepIds()
    handlers.setStepDone(rest ?? 0, true)

    const applied = handlers.applyAdjustments({
      pathId,
      skillIds: known,
      adjustments: [
        { type: 'remove-step', stepId: rest, reason: 'Sobra.' },
        {
          type: 'change-criteria',
          stepId: skill,
          criterionSessions: 9,
          criterionScore: 10,
          reason: 'x'
        }
      ]
    })

    expect(applied).toBe(false)
    expect(handlers.getCurrent()?.path.steps[1]).toMatchObject({ criterionSessions: 3 })
    expect(handlers.getCurrent()?.path.steps).toHaveLength(2)
  })

  it('refuses a skill that does not exist', () => {
    const pathId = handlers.save(path())
    const [rest] = stepIds()

    const applied = handlers.applyAdjustments({
      pathId,
      skillIds: known,
      adjustments: [
        {
          type: 'add-step',
          afterStepId: rest,
          step: {
            title: 'Yoga',
            description: '',
            kind: 'skill',
            skillId: 'yoga_flow',
            criterionSessions: 2,
            criterionScore: 70
          },
          reason: 'x'
        }
      ]
    })

    expect(applied).toBe(false)
  })

  it('refuses a review of a path that is no longer the one on show', () => {
    const old = handlers.save(path('Antigua'))
    handlers.save(path('Nueva'))
    const oldStep = repository.get(old)?.steps[1]?.id ?? 0

    const applied = handlers.applyAdjustments({
      pathId: old,
      skillIds: known,
      adjustments: [
        {
          type: 'change-criteria',
          stepId: oldStep,
          criterionSessions: 2,
          criterionScore: 50,
          reason: 'x'
        }
      ]
    })

    expect(applied).toBe(false)
  })

  it.each([
    ['no adjustments', { adjustments: [] }],
    [
      'more than five',
      { adjustments: Array(6).fill({ type: 'remove-step', stepId: 1, reason: 'x' }) }
    ],
    ['an unknown kind', { adjustments: [{ type: 'delete-all' }] }],
    ['a field that is not listed', { adjustments: [], video: 'x' }]
  ])('rejects %s', (_name, bad) => {
    const pathId = handlers.save(path())

    expect(() => handlers.applyAdjustments({ pathId, skillIds: known, ...bad })).toThrow()
  })
})
