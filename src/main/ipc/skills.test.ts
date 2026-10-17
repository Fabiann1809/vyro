import { describe, expect, it, vi } from 'vitest'
import { CustomSkillRepository } from '../db/customSkillRepository'
import { openDatabase } from '../db/database'
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
