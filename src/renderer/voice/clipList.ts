import type { Language } from '@renderer/i18n'
import type { SkillConfig } from '@renderer/engine/skillSchema'

export interface Clip {
  // Also the file name: assets/voice/<language>/<id>.wav
  id: string
  language: Language
  text: string
}

const LANGUAGES: readonly Language[] = ['es', 'en']

export const PRAISE_COUNT = 3
export const SAMPLE_CLIP_ID = 'system.sample'

export const ruleClipId = (skillId: string, ruleId: string): string => `${skillId}.${ruleId}`
export const praiseClipId = (variant: number): string => `praise.${variant}`

// Every message the user may hear. The recorded clips are made from this list, so a message that
// is not here cannot be spoken when the computer has no voice.
export function listClips(
  skills: readonly SkillConfig[],
  texts: Readonly<Record<Language, Readonly<Record<string, string>>>>
): Clip[] {
  return LANGUAGES.flatMap((language) => [
    ...skills.flatMap((skill) =>
      skill.rules.map((rule) => ({
        id: ruleClipId(skill.id, rule.id),
        language,
        text: rule.message[language]
      }))
    ),
    ...Array.from({ length: PRAISE_COUNT }, (_, variant) => ({
      id: praiseClipId(variant),
      language,
      text: texts[language][`training.praise.${variant}`] ?? ''
    })),
    { id: SAMPLE_CLIP_ID, language, text: texts[language]['settings.voice.sample'] ?? '' }
  ])
}
