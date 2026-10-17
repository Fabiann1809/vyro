import { z } from 'zod'
import { skillIdSchema, type PlanPathResult } from './pathPlan'

// Making a new skill with the AI: the person says what they want to learn, the coach writes the
// configuration of a skill, the app checks it, and it is kept as a draft until it is approved.

export const MAX_SKILL_DESCRIPTION = 500

export const generateSkillInputSchema = z
  .object({
    // What the skill is for: the goal of the person, or the step of the path that needs it.
    description: z.string().trim().min(1).max(MAX_SKILL_DESCRIPTION),
    language: z.enum(['es', 'en']),
    // The skills that already exist, so that the new one does not take an id that is in use.
    existingSkillIds: z.array(skillIdSchema).max(100)
  })
  .strict()

export type GenerateSkillInput = z.infer<typeof generateSkillInputSchema>

export type GenerateSkillResult =
  // A valid skill, kept as a draft under this id.
  | { kind: 'skill'; id: string }
  // Not coachable, or not yet: the same answers as when planning a path.
  | Extract<PlanPathResult, { kind: 'out-of-scope' | 'planned' }>
