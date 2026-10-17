import { beforeEach, describe, expect, it } from 'vitest'
import type { PathStepToSave, PathToSave } from '@shared/paths'
import { openDatabase } from './database'
import { PathProgressService } from './pathProgressService'
import { PathRepository } from './pathRepository'
import { SessionRepository } from './sessionRepository'

const CREATED = 1_000

const skill = (skillId: string, sessions = 2, score = 80): PathStepToSave => ({
  title: `Practicar ${skillId}`,
  description: '',
  kind: 'skill',
  skillId,
  criterionSessions: sessions,
  criterionScore: score
})

const rest = (title = 'Descansar'): PathStepToSave => ({
  title,
  description: '',
  kind: 'auxiliary',
  skillId: null,
  criterionSessions: null,
  criterionScore: null
})

let paths: PathRepository
let sessions: SessionRepository
let service: PathProgressService
let clock: number

const train = (skillId: string, startedAt: number, score: number | null = 90): void => {
  sessions.save({
    skillId,
    startedAt,
    durationMs: 60_000,
    score,
    reps: [{ index: 1, quality: 'good', durationMs: 2000, failedRuleIds: [] }]
  })
}

const create = (...steps: PathStepToSave[]): number =>
  paths.create({ goal: 'Mejorar', steps } as PathToSave, CREATED)

beforeEach(() => {
  const db = openDatabase(':memory:')
  paths = new PathRepository(db)
  sessions = new SessionRepository(db)
  clock = 50_000
  service = new PathProgressService(paths, sessions, () => clock)
})

describe('the progress of the path on show', () => {
  it('is nothing when there is no path', () => {
    expect(service.current()).toBeNull()
  })

  it('starts at the first step, with nothing counted', () => {
    create(skill('squat'), skill('pushup'))

    const current = service.current()

    expect(current?.progress.steps.map((step) => step.state)).toEqual(['current', 'locked'])
    expect(current?.progress.steps[0]).toMatchObject({ counted: 0, attempts: 0, required: 2 })
  })

  it('counts the sessions saved after the path was made, and ignores the earlier ones', () => {
    create(skill('squat', 2))
    train('squat', CREATED - 100)
    train('squat', CREATED + 100)

    expect(service.current()?.progress.steps[0]).toMatchObject({ counted: 1, attempts: 1 })
  })

  it('completes a skill step with the sessions, and unlocks the next', () => {
    create(skill('squat', 2), skill('pushup', 1))
    train('squat', 2_000)
    train('squat', 3_000)

    const current = service.current()

    expect(current?.progress.steps.map((step) => step.state)).toEqual(['done', 'current'])
    expect(current?.path.steps[0]?.doneAt).toBe(3_000)
    expect(current?.path.status).toBe('active')
  })

  it('keeps a step done once it is done, even if the sessions disappear', () => {
    create(skill('squat', 1), skill('pushup', 1))
    train('squat', 2_000)
    service.current()

    sessions.deleteAll()

    expect(service.current()?.progress.steps.map((step) => step.state)).toEqual(['done', 'current'])
  })

  it('does not let one session complete two steps of the same skill', () => {
    create(skill('squat', 1), skill('squat', 1))
    train('squat', 2_000)

    expect(service.current()?.progress.steps.map((step) => step.state)).toEqual(['done', 'current'])
  })

  it('marks the path completed when its last step is done', () => {
    const id = create(skill('squat', 1))
    train('squat', 2_000)

    const current = service.current()

    expect(current?.progress.completed).toBe(true)
    expect(current?.path.status).toBe('completed')
    // A completed path is still the one on show, until another one is made.
    expect(paths.getCurrent()?.id).toBe(id)
  })
})

describe('marking auxiliary steps by hand', () => {
  it('marks the first step and dates it with the clock', () => {
    create(rest(), skill('squat'))
    const stepId = paths.getCurrent()?.steps[0]?.id ?? 0

    expect(service.setStepDone(stepId, true)).toBe(true)

    expect(paths.getCurrent()?.steps[0]?.doneAt).toBe(50_000)
    expect(service.current()?.progress.steps.map((step) => step.state)).toEqual(['done', 'current'])
  })

  it('does not mark a step that is still locked', () => {
    create(skill('squat'), rest())
    const stepId = paths.getCurrent()?.steps[1]?.id ?? 0

    expect(service.setStepDone(stepId, true)).toBe(false)
    expect(paths.getCurrent()?.steps[1]?.doneAt).toBeNull()
  })

  it('does not mark a skill step by hand: it is completed by practising', () => {
    create(skill('squat'))
    const stepId = paths.getCurrent()?.steps[0]?.id ?? 0

    expect(service.setStepDone(stepId, true)).toBe(false)
  })

  it('does not unmark a step when a later one is already done', () => {
    create(rest('Uno'), rest('Dos'))
    const [one, two] = paths.getCurrent()?.steps ?? []
    service.setStepDone(one?.id ?? 0, true)
    service.setStepDone(two?.id ?? 0, true)

    expect(service.setStepDone(one?.id ?? 0, false)).toBe(false)
    expect(service.setStepDone(two?.id ?? 0, false)).toBe(true)
    expect(service.setStepDone(one?.id ?? 0, false)).toBe(true)
  })

  it('opens a completed path again when its last step is unmarked', () => {
    const id = create(rest())
    const stepId = paths.getCurrent()?.steps[0]?.id ?? 0

    service.setStepDone(stepId, true)
    expect(paths.get(id)?.status).toBe('completed')

    service.setStepDone(stepId, false)
    expect(paths.get(id)?.status).toBe('active')
  })

  it('refuses a step that does not exist, or one of a path that is not on show', () => {
    expect(service.setStepDone(404, true)).toBe(false)

    const old = create(rest())
    const oldStep = paths.get(old)?.steps[0]?.id ?? 0
    create(rest('Nueva'))

    expect(service.setStepDone(oldStep, true)).toBe(false)
  })
})
