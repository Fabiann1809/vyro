// The picture of each skill that comes with the app, for the library and the dashboard. A skill that
// has none (one the coach made) is drawn with its channels instead.
const urls = import.meta.glob<string>('../assets/illus/*.svg', {
  eager: true,
  query: '?url',
  import: 'default'
})

const FILE: Record<string, string> = {
  bicep_curl: 'curl',
  guitar_posture: 'guitarra',
  piano_hand: 'piano_mano',
  pushup: 'flexion',
  squat: 'sentadilla',
  string_tuning: 'afinar'
}

export function illustrationOf(skillId: string): string | null {
  const file = FILE[skillId]
  return (file && urls[`../assets/illus/${file}.svg`]) || null
}
