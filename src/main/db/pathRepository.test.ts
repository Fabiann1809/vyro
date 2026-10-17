import { beforeEach, describe, expect, it } from 'vitest'
import type { PathStepToSave, PathToSave } from '@shared/paths'
import { openDatabase, type Database } from './database'
import { PathRepository } from './pathRepository'

const skillStep = (skillId: string, overrides: Partial<PathStepToSave> = {}): PathStepToSave =>
  ({
    title: `Practicar ${skillId}`,
    description: 'Tres series lentas.',
    kind: 'skill',
    skillId,
    criterionSessions: 3,
    criterionScore: 80,
    ...overrides
  }) as PathStepToSave

const auxiliaryStep = (title: string): PathStepToSave => ({
  title,
  description: '',
  kind: 'auxiliary',
  skillId: null,
  criterionSessions: null,
  criterionScore: null
})

const path = (goal = 'Hacer bien una sentadilla'): PathToSave => ({
  goal,
  steps: [skillStep('squat'), auxiliaryStep('Descansar un día'), skillStep('pushup')]
})

let db: Database
let repository: PathRepository

beforeEach(() => {
  db = openDatabase(':memory:')
  repository = new PathRepository(db)
})

describe('PathRepository', () => {
  it('saves a path and reads it back with its steps in order', () => {
    const id = repository.create(path(), 1_000)

    expect(repository.get(id)).toEqual({
      id,
      goal: 'Hacer bien una sentadilla',
      createdAt: 1_000,
      status: 'active',
      steps: [
        {
          id: expect.any(Number),
          position: 1,
          title: 'Practicar squat',
          description: 'Tres series lentas.',
          kind: 'skill',
          skillId: 'squat',
          criterionSessions: 3,
          criterionScore: 80,
          doneAt: null
        },
        {
          id: expect.any(Number),
          position: 2,
          title: 'Descansar un día',
          description: '',
          kind: 'auxiliary',
          skillId: null,
          criterionSessions: null,
          criterionScore: null,
          doneAt: null
        },
        expect.objectContaining({ position: 3, skillId: 'pushup' })
      ]
    })
  })

  it('returns null for a path that does not exist', () => {
    expect(repository.get(404)).toBeNull()
  })

  it('lists the newest path first, with how many steps are done', () => {
    const older = repository.create(path('Antigua'), 1_000)
    repository.create(path('Nueva'), 2_000)
    const [first] = repository.get(older)?.steps ?? []
    repository.setStepDone(first?.id ?? 0, 1_500)

    expect(repository.list()).toEqual([
      expect.objectContaining({ goal: 'Nueva', stepCount: 3, doneCount: 0 }),
      expect.objectContaining({ goal: 'Antigua', stepCount: 3, doneCount: 1 })
    ])
  })

  it('knows the active path: the newest one that is still active', () => {
    expect(repository.getActive()).toBeNull()

    const first = repository.create(path('Primera'), 1_000)
    const second = repository.create(path('Segunda'), 2_000)
    expect(repository.getActive()?.id).toBe(second)

    repository.setStatus(second, 'archived')
    expect(repository.getActive()?.id).toBe(first)

    repository.setStatus(first, 'completed')
    expect(repository.getActive()).toBeNull()
  })

  it('marks a step done and not done again', () => {
    const id = repository.create(path(), 1_000)
    const stepId = repository.get(id)?.steps[1]?.id ?? 0

    expect(repository.setStepDone(stepId, 5_000)).toBe(true)
    expect(repository.get(id)?.steps[1]?.doneAt).toBe(5_000)

    expect(repository.setStepDone(stepId, null)).toBe(true)
    expect(repository.get(id)?.steps[1]?.doneAt).toBeNull()
  })

  it('says so when the step or the path does not exist', () => {
    expect(repository.setStepDone(404, 1)).toBe(false)
    expect(repository.setStatus(404, 'archived')).toBe(false)
    expect(repository.delete(404)).toBe(false)
  })

  it('deletes a path with its steps', () => {
    const id = repository.create(path(), 1_000)

    expect(repository.delete(id)).toBe(true)

    expect(repository.get(id)).toBeNull()
    expect((db.prepare('SELECT COUNT(*) AS n FROM path_steps').get() as { n: number }).n).toBe(0)
  })

  it('empties everything on deleteAll', () => {
    repository.create(path('Una'), 1)
    repository.create(path('Otra'), 2)

    repository.deleteAll()

    expect(repository.list()).toEqual([])
    expect((db.prepare('SELECT COUNT(*) AS n FROM path_steps').get() as { n: number }).n).toBe(0)
  })

  it('saves nothing when one step cannot be saved', () => {
    const broken: PathToSave = {
      goal: 'Rota',
      // A skill step without its skill, which the types forbid and the table refuses too.
      steps: [skillStep('squat'), skillStep('x', { skillId: null } as Partial<PathStepToSave>)]
    }

    expect(() => repository.create(broken, 1)).toThrow()
    expect(repository.list()).toEqual([])
  })
})

describe('what the table refuses by itself', () => {
  const insertPath = (): void => {
    db.exec("INSERT INTO learning_paths (goal, created_at, status) VALUES ('g', 1, 'active')")
  }

  it('refuses a skill step without a skill or without its measure', () => {
    insertPath()

    expect(() =>
      db.exec(
        "INSERT INTO path_steps (path_id, position, title, description, kind) VALUES (1, 1, 't', '', 'skill')"
      )
    ).toThrow()
  })

  it('refuses an auxiliary step that carries a skill', () => {
    insertPath()

    expect(() =>
      db.exec(
        "INSERT INTO path_steps (path_id, position, title, description, kind, skill_id) VALUES (1, 1, 't', '', 'auxiliary', 'squat')"
      )
    ).toThrow()
  })

  it('refuses two steps in the same position of a path', () => {
    insertPath()
    const step =
      "INSERT INTO path_steps (path_id, position, title, description, kind) VALUES (1, 1, 't', '', 'auxiliary')"
    db.exec(step)

    expect(() => db.exec(step)).toThrow()
  })

  it('refuses an unknown status or kind, and a step of a path that does not exist', () => {
    expect(() =>
      db.exec("INSERT INTO learning_paths (goal, created_at, status) VALUES ('g', 1, 'paused')")
    ).toThrow()
    insertPath()
    expect(() =>
      db.exec(
        "INSERT INTO path_steps (path_id, position, title, description, kind) VALUES (1, 1, 't', '', 'other')"
      )
    ).toThrow()
    expect(() =>
      db.exec(
        "INSERT INTO path_steps (path_id, position, title, description, kind) VALUES (99, 1, 't', '', 'auxiliary')"
      )
    ).toThrow()
  })
})
