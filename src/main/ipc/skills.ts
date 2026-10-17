import { ipcMain } from 'electron'
import type { CustomSkillSource } from '@shared/customSkills'
import { IPC } from '@shared/ipc'
import { generatedSkillProblems } from '@shared/skill/generatedSafety'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { CustomSkillRepository } from '../db/customSkillRepository'

interface SkillHandlers {
  listCustom: () => CustomSkillSource[]
  getDraft: () => CustomSkillSource | null
  approveDraft: (id: unknown) => boolean
  discardDraft: (id: unknown) => boolean
}

// What each channel does, apart from Electron so it can be tested.
export function createSkillHandlers(repository: CustomSkillRepository): SkillHandlers {
  // Only a draft can be approved or discarded; the skills already approved are not touched here.
  const draftWithId = (id: unknown): CustomSkillSource | null => {
    if (typeof id !== 'string') return null
    const record = repository.get(id)
    return record?.status === 'draft' ? { id: record.id, config: record.config } : null
  }

  return {
    // Only the skills the person approved are offered; a draft is not a skill yet.
    listCustom: () => repository.list('approved').map(({ id, config }) => ({ id, config })),

    // There is one draft at most: a new one takes the place of the old one.
    getDraft: () => {
      const [draft] = repository.list('draft')
      return draft ? { id: draft.id, config: draft.config } : null
    },

    // The limits are checked again: the row could have been changed since it was made.
    approveDraft: (id) => {
      const draft = draftWithId(id)
      if (!draft) return false
      const parsed = parseSkillConfig(draft.config)
      if (!parsed.ok || generatedSkillProblems(parsed.skill).length > 0) return false
      return repository.setStatus(draft.id, 'approved')
    },

    discardDraft: (id) => {
      const draft = draftWithId(id)
      return draft ? repository.delete(draft.id) : false
    }
  }
}

export function registerSkillsIpc(repository: CustomSkillRepository): void {
  const handlers = createSkillHandlers(repository)

  ipcMain.handle(IPC.skillsListCustom, () => handlers.listCustom())
  ipcMain.handle(IPC.skillsGetDraft, () => handlers.getDraft())
  ipcMain.handle(IPC.skillsApproveDraft, (_event, id: unknown) => handlers.approveDraft(id))
  ipcMain.handle(IPC.skillsDiscardDraft, (_event, id: unknown) => handlers.discardDraft(id))
}
