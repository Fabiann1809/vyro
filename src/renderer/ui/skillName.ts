import { localize } from '@renderer/i18n'
import { findSkill } from './skillsStore'

// The name of a skill in the language of the user; the id itself if there is no such skill.
export function skillDisplayName(skillId: string): string {
  const skill = findSkill(skillId)
  return skill ? localize(skill.name) : skillId
}
