import { bundledSkills } from '@renderer/skills'
import type { PlannerSkills } from './pathPlanStore'

// The skills that exist, as the coach needs to know them to plan or to review a path.
export const plannerSkills = (): PlannerSkills =>
  bundledSkills.skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    ruleIds: skill.rules.map((rule) => rule.id)
  }))
