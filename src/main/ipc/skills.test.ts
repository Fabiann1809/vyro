import { describe, expect, it, vi } from 'vitest'
import { CustomSkillRepository } from '../db/customSkillRepository'
import { openDatabase } from '../db/database'
import { EXAMPLE_SKILL } from '../ai/skillPrompts'
import { createSkillHandlers } from './skills'

// The handlers do not need Electron, but the module imports it.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

describe('skill handlers', () => {
  it('offers the approved skills with their JSON, and nothing else about them', () => {
    const repository = new CustomSkillRepository(openDatabase(':memory:'))
    repository.save('custom_yoga', { id: 'custom_yoga' }, 'approved', 1)
    const handlers = createSkillHandlers(repository)

    expect(handlers.listCustom()).toEqual([{ id: 'custom_yoga', config: { id: 'custom_yoga' } }])
  })

  it('does not offer a draft: a skill that was not approved is not a skill yet', () => {
    const repository = new CustomSkillRepository(openDatabase(':memory:'))
    repository.save('custom_draft', { id: 'custom_draft' }, 'draft', 1)

    expect(createSkillHandlers(repository).listCustom()).toEqual([])
  })

  it('offers nothing when there are no custom skills', () => {
    const handlers = createSkillHandlers(new CustomSkillRepository(openDatabase(':memory:')))

    expect(handlers.listCustom()).toEqual([])
  })
})

describe('the draft', () => {
  const setup = (): ReturnType<typeof createSkillHandlers> & {
    repository: CustomSkillRepository
  } => {
    const repository = new CustomSkillRepository(openDatabase(':memory:'))
    return { ...createSkillHandlers(repository), repository }
  }

  it('offers the draft, with its JSON', () => {
    const { getDraft, repository } = setup()
    expect(getDraft()).toBeNull()

    repository.save(EXAMPLE_SKILL.id, EXAMPLE_SKILL, 'draft', 1)

    expect(getDraft()).toEqual({ id: EXAMPLE_SKILL.id, config: EXAMPLE_SKILL })
  })

  it('approves it, and from then on it is one more skill', () => {
    const { approveDraft, listCustom, repository } = setup()
    repository.save(EXAMPLE_SKILL.id, EXAMPLE_SKILL, 'draft', 1)

    expect(approveDraft(EXAMPLE_SKILL.id)).toBe(true)

    expect(listCustom().map((skill) => skill.id)).toEqual([EXAMPLE_SKILL.id])
  })

  it('does not approve a draft that breaks the limits, or one that does not exist', () => {
    const { approveDraft, listCustom, repository } = setup()
    const rules = EXAMPLE_SKILL.rules.map((rule) => ({ ...rule, severity: 'low' }))
    repository.save('custom_soft', { ...EXAMPLE_SKILL, id: 'custom_soft', rules }, 'draft', 1)

    expect(approveDraft('custom_soft')).toBe(false)
    expect(approveDraft('custom_nothing')).toBe(false)
    expect(approveDraft(42)).toBe(false)
    expect(listCustom()).toEqual([])
  })

  it('discards a draft, but never touches a skill that was approved', () => {
    const { discardDraft, repository } = setup()
    repository.save('custom_draft', EXAMPLE_SKILL, 'draft', 1)
    repository.save('custom_ok', EXAMPLE_SKILL, 'approved', 2)

    expect(discardDraft('custom_ok')).toBe(false)
    expect(discardDraft('custom_draft')).toBe(true)

    expect(repository.list().map((record) => record.id)).toEqual(['custom_ok'])
  })
})
