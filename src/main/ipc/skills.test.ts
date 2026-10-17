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

describe('saving the skill adjusted to the person', () => {
  const setup = (): ReturnType<typeof createSkillHandlers> & {
    repository: CustomSkillRepository
  } => {
    const repository = new CustomSkillRepository(openDatabase(':memory:'))
    repository.save(EXAMPLE_SKILL.id, EXAMPLE_SKILL, 'approved', 1)
    return { ...createSkillHandlers(repository), repository }
  }
  const adjusted = (check: string): unknown => ({
    ...EXAMPLE_SKILL,
    rules: EXAMPLE_SKILL.rules.map((rule) => (rule.id === 'depth' ? { ...rule, check } : rule))
  })

  it('keeps the adjusted JSON of an approved skill', () => {
    const { saveCalibrated, repository } = setup()

    expect(saveCalibrated(EXAMPLE_SKILL.id, adjusted('min(knee) <= 108'))).toBe(true)

    expect(JSON.stringify(repository.get(EXAMPLE_SKILL.id)?.config)).toContain('min(knee) <= 108')
  })

  it('refuses a skill that is not valid, or that is another skill', () => {
    const { saveCalibrated, repository } = setup()

    expect(saveCalibrated(EXAMPLE_SKILL.id, adjusted('process.exit(1)'))).toBe(false)
    expect(saveCalibrated(EXAMPLE_SKILL.id, { ...EXAMPLE_SKILL, id: 'custom_other' })).toBe(false)
    expect(saveCalibrated(EXAMPLE_SKILL.id, 'nonsense')).toBe(false)
    expect(JSON.stringify(repository.get(EXAMPLE_SKILL.id)?.config)).toContain('min(knee) <= 100')
  })

  it('refuses one that breaks the limits of generated skills', () => {
    const { saveCalibrated } = setup()
    const reckless = { ...EXAMPLE_SKILL, rep: { ...EXAMPLE_SKILL.rep, minDurationMs: 5 } }

    expect(saveCalibrated(EXAMPLE_SKILL.id, reckless)).toBe(false)
  })

  it('only adjusts approved skills: not a draft, not one that does not exist', () => {
    const { saveCalibrated, repository } = setup()
    repository.save('custom_draft', { ...EXAMPLE_SKILL, id: 'custom_draft' }, 'draft', 2)

    expect(saveCalibrated('custom_draft', { ...EXAMPLE_SKILL, id: 'custom_draft' })).toBe(false)
    expect(saveCalibrated('custom_nothing', EXAMPLE_SKILL)).toBe(false)
    expect(saveCalibrated(7, EXAMPLE_SKILL)).toBe(false)
  })
})
