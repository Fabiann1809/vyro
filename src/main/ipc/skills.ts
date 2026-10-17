import { ipcMain } from 'electron'
import type { CustomSkillSource } from '@shared/customSkills'
import { IPC } from '@shared/ipc'
import type { CustomSkillRepository } from '../db/customSkillRepository'

// What each channel does, apart from Electron so it can be tested.
export function createSkillHandlers(repository: CustomSkillRepository): {
  listCustom: () => CustomSkillSource[]
} {
  return {
    // Only the skills the person approved are offered; a draft is not a skill yet.
    listCustom: () => repository.list('approved').map(({ id, config }) => ({ id, config }))
  }
}

export function registerSkillsIpc(repository: CustomSkillRepository): void {
  const handlers = createSkillHandlers(repository)

  ipcMain.handle(IPC.skillsListCustom, () => handlers.listCustom())
}
