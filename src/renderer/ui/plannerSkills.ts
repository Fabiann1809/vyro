import type { PlannerSkills } from './pathPlanStore'
import { useSkills } from './skillsStore'

// The skills that exist, as the coach needs to know them to plan or to review a path.
export const plannerSkills = (): PlannerSkills =>
  useSkills.getState().skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    ruleIds: skill.rules.map((rule) => rule.id)
  }))
