import { personalizeSkill } from '@renderer/engine/personalCalibration'
import type { CompletedRep } from '@renderer/engine/repCounter'
import type { VyroApi } from '@shared/ipc'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { loadCustomSkills } from './skillsStore'

export type PersonalOutcome = 'saved' | 'unchanged' | 'failed'

type PersonalApi = { skills: Pick<VyroApi['skills'], 'listCustom' | 'saveCalibrated'> }

// Adjusts a generated skill to one good repetition, keeps the result and makes the app use it.
export async function adjustSkillToPerson(
  api: PersonalApi,
  skill: SkillConfig,
  rep: CompletedRep
): Promise<PersonalOutcome> {
  const { skill: personal, changes } = personalizeSkill(skill, rep)
  if (changes.length === 0) return 'unchanged'

  try {
    if (!(await api.skills.saveCalibrated(skill.id, personal))) return 'failed'
    await loadCustomSkills(api)
    return 'saved'
  } catch {
    return 'failed'
  }
}
