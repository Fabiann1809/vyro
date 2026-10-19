import type { SkillConfig } from './skillSchema'

// The posture of the person who plays the guitar is judged once, in this skill that comes with the
// app. The lessons that teach (open strings, chords) do not judge it again.
export const GUITAR_POSTURE_ID = 'guitar_posture'

interface Nameable {
  id: string
  name: { es: string; en: string }
  object?: SkillConfig['object']
}

export const mentionsGuitar = (skill: Nameable): boolean =>
  skill.object === 'guitar' || /guitar/i.test(`${skill.id} ${skill.name.es} ${skill.name.en}`)

// A skill about the guitar that is not the posture itself.
export const isGuitarLesson = (skill: Nameable): boolean =>
  skill.id !== GUITAR_POSTURE_ID && mentionsGuitar(skill)
