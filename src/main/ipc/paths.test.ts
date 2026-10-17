import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PathToSave } from '@shared/paths'
import { openDatabase } from '../db/database'
import { PathRepository } from '../db/pathRepository'
import { createPathHandlers } from './paths'

// The handlers do not need Electron, but the module imports it.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

const path = (goal = 'Mejorar mi sentadilla'): PathToSave => ({
  goal,
  steps: [
    {
      title: 'Sentadilla lenta',
      description: 'Baja en tres segundos.',
      kind: 'skill',
      skillId: 'squat',
      criterionSessions: 3,
      criterionScore: 75
    },
    {
      title: 'Descansar',
      description: '',
      kind: 'auxiliary',
      skillId: null,
      criterionSessions: null,
      criterionScore: null
    }
  ]
})

let handlers: ReturnType<typeof createPathHandlers>
let repository: PathRepository

beforeEach(() => {
  repository = new PathRepository(openDatabase(':memory:'))
  handlers = createPathHandlers(repository)
})

describe('path handlers', () => {
  it('has no active path to begin with', () => {
    expect(handlers.getActive()).toBeNull()
  })

  it('saves a path and gives it back as the active one', () => {
    const id = handlers.save(path())

    expect(handlers.getActive()).toMatchObject({
      id,
      goal: 'Mejorar mi sentadilla',
      status: 'active',
      steps: [expect.objectContaining({ position: 1 }), expect.objectContaining({ position: 2 })]
    })
  })

  it('sets the date itself, not the page', () => {
    const before = Date.now()
    handlers.save(path())
    const after = Date.now()

    const createdAt = handlers.getActive()?.createdAt ?? 0
    expect(createdAt).toBeGreaterThanOrEqual(before)
    expect(createdAt).toBeLessThanOrEqual(after)
  })

  it('follows one path at a time: a new one archives the previous', () => {
    const first = handlers.save(path('Primera'))
    const second = handlers.save(path('Segunda'))

    expect(handlers.getActive()?.id).toBe(second)
    expect(repository.get(first)?.status).toBe('archived')
  })

  it.each([
    ['something that is not a path', 'hola'],
    ['a path without steps', { goal: 'x', steps: [] }],
    ['a field that is not listed', { ...path(), video: 'x' }],
    [
      'a skill step without its skill',
      { goal: 'x', steps: [{ ...path().steps[0], skillId: null }] }
    ]
  ])('rejects %s, and saves nothing', (_name, bad) => {
    expect(() => handlers.save(bad)).toThrow()
    expect(repository.list()).toEqual([])
  })

  it('marks a step done with the date of now, and not done again', () => {
    handlers.save(path())
    const stepId = handlers.getActive()?.steps[1]?.id ?? 0

    expect(handlers.setStepDone(stepId, true)).toBe(true)
    expect(handlers.getActive()?.steps[1]?.doneAt).toEqual(expect.any(Number))

    expect(handlers.setStepDone(stepId, false)).toBe(true)
    expect(handlers.getActive()?.steps[1]?.doneAt).toBeNull()
  })

  it('says so when the step does not exist', () => {
    expect(handlers.setStepDone(404, true)).toBe(false)
    expect(handlers.archive(404)).toBe(false)
  })

  it('archives a path, which is then no longer the active one', () => {
    const id = handlers.save(path())

    expect(handlers.archive(id)).toBe(true)

    expect(handlers.getActive()).toBeNull()
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
