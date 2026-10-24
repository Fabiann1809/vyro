import type { SkillConfig } from '@shared/skill/skillSchema'

// The same skill aimed at another note: every pitch metric is measured from `note` instead of from
// where it was aimed. The engine judges as always; only the note changes.
export function retarget(skill: SkillConfig, note: string): SkillConfig {
  const metrics = Object.fromEntries(
    Object.entries(skill.metrics).map(([name, metric]) => [
      name,
      metric.type === 'pitch' ? { ...metric, target: note } : metric
    ])
  )
  return { ...skill, metrics }
}
