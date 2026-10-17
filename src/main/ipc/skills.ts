import { ipcMain } from 'electron'
import type { CustomSkillSource } from '@shared/customSkills'
import { IPC } from '@shared/ipc'
import { generatedSkillProblems } from '@shared/skill/generatedSafety'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { CustomSkillRepository } from '../db/customSkillRepository'
import type { PathRepository } from '../db/pathRepository'

interface SkillHandlers {
  listCustom: () => CustomSkillSource[]
  getDraft: () => CustomSkillSource | null
  approveDraft: (id: unknown) => boolean
  discardDraft: (id: unknown) => boolean
  saveCalibrated: (id: unknown, config: unknown) => boolean
  delete: (id: unknown) => boolean
}

// What each channel does, apart from Electron so it can be tested.
export function createSkillHandlers(
  repository: CustomSkillRepository,
  paths: Pick<PathRepository, 'archiveUsingSkill'>
): SkillHandlers {
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

    // The adjusted skill has to be the same skill, valid, and inside the limits of generated ones.
    saveCalibrated: (id, config) => {
      if (typeof id !== 'string' || repository.get(id)?.status !== 'approved') return false
      const parsed = parseSkillConfig(config)
      if (!parsed.ok || parsed.skill.id !== id) return false
      if (generatedSkillProblems(parsed.skill).length > 0) return false
      return repository.updateConfig(id, config)
    },

    // Sessions are not touched: what was practised stays in the history. The path that asked for
    // the skill cannot go on, so it is archived.
    delete: (id) => {
      if (typeof id !== 'string' || !repository.delete(id)) return false
      paths.archiveUsingSkill(id)
      return true
    },

    discardDraft: (id) => {
      const draft = draftWithId(id)
      return draft ? repository.delete(draft.id) : false
    }
  }
}

export function registerSkillsIpc(
  repository: CustomSkillRepository,
  paths: Pick<PathRepository, 'archiveUsingSkill'>
): void {
  const handlers = createSkillHandlers(repository, paths)

  ipcMain.handle(IPC.skillsListCustom, () => handlers.listCustom())
  ipcMain.handle(IPC.skillsGetDraft, () => handlers.getDraft())
  ipcMain.handle(IPC.skillsApproveDraft, (_event, id: unknown) => handlers.approveDraft(id))
  ipcMain.handle(IPC.skillsSaveCalibrated, (_event, id: unknown, config: unknown) =>
    handlers.saveCalibrated(id, config)
  )
  ipcMain.handle(IPC.skillsDelete, (_event, id: unknown) => handlers.delete(id))
  ipcMain.handle(IPC.skillsDiscardDraft, (_event, id: unknown) => handlers.discardDraft(id))
}
