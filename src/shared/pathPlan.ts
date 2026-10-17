import { z } from 'zod'
import { coachTurnsSchema } from './coach'
import type { Channel, OutOfScopeReason } from './feasibility'
import type { PathToSave } from './paths'

// Planning a learning path is a conversation: the user says what they want to learn, the planner
// may ask up to MAX_QUESTIONS things, and then proposes a path or says why it cannot.

export const MAX_QUESTIONS = 3

export const skillIdSchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/)
const skillId = skillIdSchema

// The skills that exist, so that a path only uses skills that can really be measured.
export const plannerSkillsSchema = z
  .array(
    z
      .object({
        id: skillId,
        name: z.object({ es: z.string().min(1).max(60), en: z.string().min(1).max(60) }).strict(),
        // What the skill corrects, by the internal names of its rules.
        ruleIds: z.array(skillId).max(20)
      })
      .strict()
  )
  .min(1)
  .max(50)

export const planPathInputSchema = z
  .object({
    turns: coachTurnsSchema,
    language: z.enum(['es', 'en']),
    skills: plannerSkillsSchema
  })
  .strict()

export type PlanPathInput = z.infer<typeof planPathInputSchema>

export type PlanPathResult =
  // The planner needs to know something more before proposing.
  | { kind: 'question'; question: string }
  // A path, ready to show and to save.
  | { kind: 'path'; path: PathToSave }
  // VYRO cannot coach it, whatever channels exist. `measurable` is the part it could.
  | { kind: 'out-of-scope'; reasons: OutOfScopeReason[]; measurable: Channel[] }
  // It can, but a channel it needs has not arrived yet.
  | {
      kind: 'planned'
      pending: Array<{ channel: Channel; phase: number | null }>
      measurable: Channel[]
    }
  // The channels exist, but there is no skill that trains this yet.
  | { kind: 'no-matching-skill' }
