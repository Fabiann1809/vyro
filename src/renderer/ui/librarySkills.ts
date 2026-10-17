import type { MessageKey } from '@renderer/i18n'
import { isGeneratedSkillId } from '@shared/skill/generatedSafety'
import { skillChannels, type SkillChannel } from '@shared/skill/skillChannels'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { sortChannels } from './kit/channels'

// What the library shows of a skill, and the choices to narrow the list down.

export type LibraryCategory = 'fitness' | 'music' | 'generated' | 'other'

export interface LibrarySkill {
  skill: SkillConfig
  category: LibraryCategory
  channels: SkillChannel[]
}

export interface LibraryFilter {
  // null = every channel
  channel: SkillChannel | null
  // null = every category
  category: LibraryCategory | null
}

// The categories that are offered as a choice; "other" is only found under "all".
export const FILTER_CATEGORIES: readonly LibraryCategory[] = ['fitness', 'music', 'generated']

// A skill made by the AI is always "generated", whatever category it was given.
export function categoryOf(skill: SkillConfig): LibraryCategory {
  if (isGeneratedSkillId(skill.id)) return 'generated'
  if (skill.category === 'exercise') return 'fitness'
  if (skill.category === 'instrument') return 'music'
  return 'other'
}

export const toLibrarySkill = (skill: SkillConfig): LibrarySkill => ({
  skill,
  category: categoryOf(skill),
  channels: sortChannels(skillChannels(skill))
})

export function filterSkills(
  skills: readonly LibrarySkill[],
  filter: LibraryFilter
): LibrarySkill[] {
  return skills.filter(
    (entry) =>
      (filter.channel === null || entry.channels.includes(filter.channel)) &&
      (filter.category === null || entry.category === filter.category)
  )
}

// What the person needs to have at hand to practise it.
export function skillNeeds(skill: SkillConfig): MessageKey[] {
  const channels = skillChannels(skill)
  const needs: MessageKey[] = []
  if (channels.some((channel) => channel !== 'audio')) needs.push('library.needs.camera')
  if (channels.includes('audio')) needs.push('library.needs.microphone')
  if (skill.object === 'guitar') needs.push('library.needs.guitar')
  return needs
}

// One line about each skill that comes with the app. A skill made later has none, so it gets a
// generic one.
const LINES: Record<string, MessageKey> = {
  squat: 'library.line.squat',
  pushup: 'library.line.pushup',
  bicep_curl: 'library.line.bicep_curl',
  piano_hand: 'library.line.piano_hand',
  piano_note: 'library.line.piano_note',
  steady_beat: 'library.line.steady_beat',
  string_tuning: 'library.line.string_tuning',
  guitar_posture: 'library.line.guitar_posture'
}

export const skillLine = (skill: SkillConfig): MessageKey =>
  LINES[skill.id] ?? 'library.line.generated'
