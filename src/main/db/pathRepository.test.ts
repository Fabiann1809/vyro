import { beforeEach, describe, expect, it } from 'vitest'
import type { PathStepToSave, PathToSave } from '@shared/paths'
import type { Adjustment } from '@shared/pathReview'
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
          doneAt: null,
          guide: null
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
          doneAt: null,
          guide: null
        },
        expect.objectContaining({ position: 3, skillId: 'pushup' })
      ]
    })
  })

  it('keeps the guide of a step, and reads a damaged one as no guide', () => {
    const guide = {
      tips: ['Círculos de cadera, diez por lado.'],
      minutes: 5,
      diagrams: [{ kind: 'chord' as const, name: 'Am' as const }]
    }
    const id = repository.create(
      { goal: 'Con pautas', steps: [skillStep('squat'), { ...auxiliaryStep('Calentar'), guide }] },
      1_000
    )

    expect(repository.get(id)?.steps.map((step) => step.guide)).toEqual([null, guide])

    db.prepare("UPDATE path_steps SET guide_json = '{no es json' WHERE position = 2").run()
    expect(repository.get(id)?.steps[1]?.guide).toBeNull()
    db.prepare('UPDATE path_steps SET guide_json = \'{"tips":[]}\' WHERE position = 2').run()
    expect(repository.get(id)?.steps[1]?.guide).toBeNull()
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

  it('lists the skills each path practises, without repeats', () => {
    repository.create(
      {
        goal: 'Doble',
        steps: [skillStep('squat'), skillStep('squat'), auxiliaryStep('Descansar')]
      },
      1_000
    )

    expect(repository.list()[0]?.skillIds).toEqual(['squat'])
  })

  it('resumes an archived path and archives the one on show', () => {
    const first = repository.create(path('Primera'), 1_000)
    const second = repository.create(path('Segunda'), 2_000)
    repository.archiveCurrent()
    repository.setStatus(second, 'active')
    repository.setStatus(first, 'archived')

    expect(repository.resume(first)).toBe(true)

    expect(repository.get(first)?.status).toBe('active')
    expect(repository.get(second)?.status).toBe('archived')
    // The older one is the one on show now, although the other is newer.
    expect(repository.getCurrent()?.id).toBe(first)
  })

  it('cannot resume a path that does not exist, and changes nothing', () => {
    const only = repository.create(path(), 1_000)

    expect(repository.resume(404)).toBe(false)

    expect(repository.get(only)?.status).toBe('active')
  })

  it('knows the path on show: the newest one that is active or completed', () => {
    expect(repository.getCurrent()).toBeNull()

    const first = repository.create(path('Primera'), 1_000)
    const second = repository.create(path('Segunda'), 2_000)
    expect(repository.getCurrent()?.id).toBe(second)

    repository.setStatus(second, 'archived')
    expect(repository.getCurrent()?.id).toBe(first)

    repository.setStatus(first, 'completed')
    expect(repository.getCurrent()?.id).toBe(first)

    repository.setStatus(first, 'archived')
    expect(repository.getCurrent()).toBeNull()
  })

  it('archives the paths on show, completed ones included, and no other', () => {
    const active = repository.create(path('Activa'), 1_000)
    const completed = repository.create(path('Completada'), 2_000)
    repository.setStatus(completed, 'completed')

    repository.archiveCurrent()

    expect(repository.get(active)?.status).toBe('archived')
    expect(repository.get(completed)?.status).toBe('archived')
    expect(repository.getCurrent()).toBeNull()
  })

  it('finds the path of a step', () => {
    const id = repository.create(path(), 1_000)
    const stepId = repository.get(id)?.steps[0]?.id ?? 0

    expect(repository.pathOfStep(stepId)).toBe(id)
    expect(repository.pathOfStep(404)).toBeNull()
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

describe('applying the adjustments of a review', () => {
  // Three steps: skill squat, rest, skill pushup.
  const setup = (): { pathId: number; ids: number[] } => {
    const pathId = repository.create(path(), 1_000)
    return { pathId, ids: repository.get(pathId)?.steps.map((step) => step.id) ?? [] }
  }
  const titles = (pathId: number): string[] =>
    repository.get(pathId)?.steps.map((step) => step.title) ?? []
  const positions = (pathId: number): number[] =>
    repository.get(pathId)?.steps.map((step) => step.position) ?? []

  const newStep = (title: string): PathStepToSave => auxiliaryStep(title)

  it('changes the goal of a step and nothing else', () => {
    const { pathId, ids } = setup()
    const change: Adjustment = {
      type: 'change-criteria',
      stepId: ids[0] ?? 0,
      criterionSessions: 5,
      criterionScore: 60,
      reason: 'Más práctica.'
    }

    repository.applyAdjustments(pathId, [change])

    expect(repository.get(pathId)?.steps[0]).toMatchObject({
      criterionSessions: 5,
      criterionScore: 60,
      title: 'Practicar squat'
    })
    expect(titles(pathId)).toHaveLength(3)
  })

  it('removes a step and closes the gap in the positions', () => {
    const { pathId, ids } = setup()

    repository.applyAdjustments(pathId, [
      { type: 'remove-step', stepId: ids[1] ?? 0, reason: 'Sobra.' }
    ])

    expect(titles(pathId)).toEqual(['Practicar squat', 'Practicar pushup'])
    expect(positions(pathId)).toEqual([1, 2])
  })

  it('adds a step right after another one and renumbers', () => {
    const { pathId, ids } = setup()

    repository.applyAdjustments(pathId, [
      { type: 'add-step', afterStepId: ids[0] ?? 0, step: newStep('Nuevo'), reason: 'Falta.' }
    ])

    expect(titles(pathId)).toEqual([
      'Practicar squat',
      'Nuevo',
      'Descansar un día',
      'Practicar pushup'
    ])
    expect(positions(pathId)).toEqual([1, 2, 3, 4])
  })

  it('adds a step at the end', () => {
    const { pathId, ids } = setup()

    repository.applyAdjustments(pathId, [
      { type: 'add-step', afterStepId: ids[2] ?? 0, step: newStep('Final'), reason: 'Falta.' }
    ])

    expect(titles(pathId).at(-1)).toBe('Final')
  })

  it('keeps the given order for several steps added after the same one', () => {
    const { pathId, ids } = setup()

    repository.applyAdjustments(pathId, [
      { type: 'add-step', afterStepId: ids[0] ?? 0, step: newStep('Uno'), reason: 'a' },
      { type: 'add-step', afterStepId: ids[0] ?? 0, step: newStep('Dos'), reason: 'b' }
    ])

    expect(titles(pathId).slice(0, 3)).toEqual(['Practicar squat', 'Uno', 'Dos'])
  })

  it('does everything of one review together', () => {
    const { pathId, ids } = setup()

    repository.applyAdjustments(pathId, [
      { type: 'remove-step', stepId: ids[1] ?? 0, reason: 'a' },
      {
        type: 'change-criteria',
        stepId: ids[2] ?? 0,
        criterionSessions: 4,
        criterionScore: 65,
        reason: 'b'
      },
      { type: 'add-step', afterStepId: ids[0] ?? 0, step: newStep('Entre medias'), reason: 'c' }
    ])

    expect(titles(pathId)).toEqual(['Practicar squat', 'Entre medias', 'Practicar pushup'])
    expect(positions(pathId)).toEqual([1, 2, 3])
    expect(repository.get(pathId)?.steps[2]).toMatchObject({ criterionSessions: 4 })
  })

  it('leaves the done steps as they were', () => {
    const { pathId, ids } = setup()
    repository.setStepDone(ids[0] ?? 0, 7_000)

    repository.applyAdjustments(pathId, [
      { type: 'add-step', afterStepId: ids[0] ?? 0, step: newStep('Nuevo'), reason: 'a' }
    ])

    expect(repository.get(pathId)?.steps[0]).toMatchObject({
      title: 'Practicar squat',
      doneAt: 7_000
    })
  })

  it('changes nothing if one of the adjustments cannot be applied', () => {
    const { pathId, ids } = setup()

    expect(() =>
      repository.applyAdjustments(pathId, [
        { type: 'remove-step', stepId: ids[1] ?? 0, reason: 'a' },
        // Hung from the step that was just removed.
        { type: 'add-step', afterStepId: ids[1] ?? 0, step: newStep('Huérfano'), reason: 'b' }
      ])
    ).toThrow()

    expect(titles(pathId)).toEqual(['Practicar squat', 'Descansar un día', 'Practicar pushup'])
    expect(positions(pathId)).toEqual([1, 2, 3])
  })

  it('does not touch the steps of another path', () => {
    const { pathId } = setup()
    const other = repository.create(path('Otra'), 2_000)
    const otherStep = repository.get(other)?.steps[1]?.id ?? 0

    repository.applyAdjustments(pathId, [{ type: 'remove-step', stepId: otherStep, reason: 'a' }])

    expect(titles(other)).toHaveLength(3)
  })

  describe('archiveUsingSkill', () => {
    it('closes the path on show that practises the skill', () => {
      const repository = new PathRepository(db)
      repository.create(path(), 1)

      expect(repository.archiveUsingSkill('pushup')).toBe(true)

      expect(repository.getCurrent()).toBeNull()
    })

    it('leaves alone a path that does not use it', () => {
      const repository = new PathRepository(db)
      repository.create(path(), 1)

      expect(repository.archiveUsingSkill('bicep_curl')).toBe(false)

      expect(repository.getCurrent()).not.toBeNull()
    })
  })
})
