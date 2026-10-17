import type { VyroApi } from '@shared/ipc'
import { loadCustomSkills } from './skillsStore'

type DeleteApi = { skills: Pick<VyroApi['skills'], 'delete' | 'listCustom'> }

// Deletes a skill the AI made and takes it out of the app. Whether it could be done.
export async function deleteGeneratedSkill(api: DeleteApi, id: string): Promise<boolean> {
  try {
    if (!(await api.skills.delete(id))) return false
    await loadCustomSkills(api)
    return true
  } catch {
    return false
  }
}
