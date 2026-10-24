import type { SkillConfig } from './skillSchema'

// The note a skill asks the person to play: the target of its first pitch metric that names one.
// A pitch that is measured from the nearest note, whichever it is, has no single note to show.
export function skillTargetNote(skill: Pick<SkillConfig, 'metrics'>): string | null {
  for (const metric of Object.values(skill.metrics)) {
    if (metric.type === 'pitch' && metric.target !== 'nearest') return metric.target
  }
  return null
}
