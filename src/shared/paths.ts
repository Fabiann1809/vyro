import { z } from 'zod'

// A learning path: the steps that lead to a goal, each one either a skill that VYRO can measure or
// a small auxiliary task (a rest day, a short bit of theory). Only text and numbers.

export type PathStatus = 'active' | 'completed' | 'archived'
export type StepKind = 'skill' | 'auxiliary'

export const PATH_STATUSES: readonly PathStatus[] = ['active', 'completed', 'archived']

const identifier = z.string().min(1).max(64)

const stepBase = {
  title: z.string().trim().min(1).max(120),
  // Why this step and how to do it, in a sentence or two.
  description: z.string().trim().max(600)
}

// A skill step is done after some sessions with at least some score; an auxiliary one has no
// measure and the user marks it done.
const skillStep = z
  .object({
    ...stepBase,
    kind: z.literal('skill'),
    skillId: identifier,
    criterionSessions: z.number().int().min(1).max(50),
    criterionScore: z.number().int().min(0).max(100)
  })
  .strict()

const auxiliaryStep = z
  .object({
    ...stepBase,
    kind: z.literal('auxiliary'),
    skillId: z.null(),
    criterionSessions: z.null(),
    criterionScore: z.null()
  })
  .strict()

export const pathStepToSaveSchema = z.discriminatedUnion('kind', [skillStep, auxiliaryStep])

export const MAX_PATH_STEPS = 30

export const pathToSaveSchema = z
  .object({
    goal: z.string().trim().min(1).max(200),
    steps: z.array(pathStepToSaveSchema).min(1).max(MAX_PATH_STEPS)
  })
  .strict()

export type PathStepToSave = z.infer<typeof pathStepToSaveSchema>
export type PathToSave = z.infer<typeof pathToSaveSchema>

export type PathStep = PathStepToSave & {
  id: number
  // 1, 2, 3... in the order to follow.
  position: number
  // Milliseconds since 1970; null while it is not done.
  doneAt: number | null
}

export interface LearningPath {
  id: number
  goal: string
  createdAt: number
  status: PathStatus
  steps: PathStep[]
}

export interface PathSummary {
  id: number
  goal: string
  createdAt: number
  status: PathStatus
  stepCount: number
  doneCount: number
  // The skills its steps practise, so that a path whose skill is gone is not offered to resume.
  skillIds: string[]
}
