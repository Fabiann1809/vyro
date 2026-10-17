import { z } from 'zod'
import { MAX_PATH_STEPS, pathStepToSaveSchema, type LearningPath } from './paths'
import { plannerSkillsSchema, skillIdSchema } from './pathPlan'

// The weekly review of a path: the coach looks at the numbers of the week and may propose changes,
// which the person accepts or not one by one. Only steps that are not done can be touched.

const identifier = z.string().min(1).max(64)
const count = z.number().int().min(0).max(100_000)
const reason = z.string().trim().min(1).max(300)

export const MAX_ADJUSTMENTS = 5

export const adjustmentSchema = z.discriminatedUnion('type', [
  // A different goal for a step: more or fewer sessions, a higher or lower score.
  z
    .object({
      type: z.literal('change-criteria'),
      stepId: z.number().int().min(1),
      criterionSessions: z.number().int().min(1).max(50),
      criterionScore: z.number().int().min(0).max(100),
      reason
    })
    .strict(),
  // A new step, put right after another one.
  z
    .object({
      type: z.literal('add-step'),
      afterStepId: z.number().int().min(1),
      step: pathStepToSaveSchema,
      reason
    })
    .strict(),
  z.object({ type: z.literal('remove-step'), stepId: z.number().int().min(1), reason }).strict()
])

export type Adjustment = z.infer<typeof adjustmentSchema>

export const reviewResultSchema = z
  .object({
    // How the week went, in a few sentences.
    summary: z.string().trim().min(1).max(800),
    // Empty when the path is fine as it is.
    adjustments: z.array(adjustmentSchema).max(MAX_ADJUSTMENTS)
  })
  .strict()

export type ReviewResult = z.infer<typeof reviewResultSchema>

// What the person sees: the review, and the path it is about.
export interface PathReview extends ReviewResult {
  pathId: number
}

// What goes to the coach: the path and the numbers of the sessions since it began. No dates of the
// calendar, only how long ago the path began.
export const reviewDigestSchema = z
  .object({
    goal: z.string().min(1).max(200),
    daysSinceStart: z.number().int().min(0).max(3650),
    steps: z
      .array(
        z
          .object({
            id: z.number().int().min(1),
            position: z.number().int().min(1),
            title: z.string().min(1).max(120),
            kind: z.enum(['skill', 'auxiliary']),
            skillId: identifier.nullable(),
            criterionSessions: z.number().int().nullable(),
            criterionScore: z.number().int().nullable(),
            state: z.enum(['done', 'current', 'locked']),
            counted: count.nullable(),
            attempts: count.nullable()
          })
          .strict()
      )
      .max(MAX_PATH_STEPS),
    skills: z
      .array(
        z
          .object({
            skillId: identifier,
            sessions: count,
            averageScore: z.number().int().min(0).max(100).nullable(),
            // The most recent scores, oldest first.
            lastScores: z.array(z.number().int().min(0).max(100)).max(5),
            errors: z.array(z.object({ ruleId: identifier, count }).strict()).max(20)
          })
          .strict()
      )
      .max(20)
  })
  .strict()

export type ReviewDigest = z.infer<typeof reviewDigestSchema>

// Why a set of adjustments cannot be applied to a path as it is now. Empty means it can. The same
// rules check what the coach proposes (so it can fix it) and what is about to be applied (so that
// nothing that changed in between, or that the page made up, gets through).
export function adjustmentProblems(
  path: LearningPath,
  adjustments: readonly Adjustment[],
  knownSkillIds: readonly string[]
): string[] {
  const problems: string[] = []
  const byId = new Map(path.steps.map((step) => [step.id, step]))
  const lastDone = Math.max(
    0,
    ...path.steps.filter((s) => s.doneAt !== null).map((s) => s.position)
  )

  const touched = new Set<number>()
  const removed = new Set<number>()
  let added = 0
  let addedSkillSteps = 0

  adjustments.forEach((adjustment, index) => {
    const where = `adjustment ${index + 1}`

    if (adjustment.type === 'add-step') {
      const anchor = byId.get(adjustment.afterStepId)
      if (!anchor) problems.push(`${where}: step ${adjustment.afterStepId} does not exist.`)
      else if (anchor.position < lastDone) {
        problems.push(`${where}: a step cannot be added before one that is already done.`)
      }
      if (adjustment.step.kind === 'skill' && !knownSkillIds.includes(adjustment.step.skillId)) {
        problems.push(
          `${where}: unknown skill "${adjustment.step.skillId}". Use one of: ${knownSkillIds.join(', ')}.`
        )
      }
      added++
      if (adjustment.step.kind === 'skill') addedSkillSteps++
      return
    }

    const step = byId.get(adjustment.stepId)
    if (!step) {
      problems.push(`${where}: step ${adjustment.stepId} does not exist.`)
      return
    }
    if (step.doneAt !== null) problems.push(`${where}: step ${step.id} is already done.`)
    if (touched.has(step.id)) problems.push(`${where}: step ${step.id} is changed twice.`)
    touched.add(step.id)

    if (adjustment.type === 'change-criteria') {
      if (step.kind !== 'skill') {
        problems.push(`${where}: step ${step.id} is auxiliary and has no goal to change.`)
      }
    } else {
      removed.add(step.id)
    }
  })

  // An add-step must not hang from a step that is removed in the same review.
  adjustments.forEach((adjustment, index) => {
    if (adjustment.type === 'add-step' && removed.has(adjustment.afterStepId)) {
      problems.push(`adjustment ${index + 1}: it is put after a step that is being removed.`)
    }
  })

  if (path.steps.length - removed.size + added > MAX_PATH_STEPS) {
    problems.push(`The path would have more than ${MAX_PATH_STEPS} steps.`)
  }
  const remainingSkillSteps =
    path.steps.filter((step) => step.kind === 'skill' && !removed.has(step.id)).length +
    addedSkillSteps
  if (remainingSkillSteps === 0) problems.push('The path would be left with no skill step.')

  return problems
}

// Asking for the review of the path on show: which skills exist is all the page has to say.
export const reviewPathInputSchema = z
  .object({ language: z.enum(['es', 'en']), skills: plannerSkillsSchema })
  .strict()

export type ReviewPathInput = z.infer<typeof reviewPathInputSchema>

// Applying what the person accepted.
export const applyAdjustmentsInputSchema = z
  .object({
    pathId: z.number().int().min(1),
    adjustments: z.array(adjustmentSchema).min(1).max(MAX_ADJUSTMENTS),
    skillIds: z.array(skillIdSchema).max(50)
  })
  .strict()

export type ApplyAdjustmentsInput = z.infer<typeof applyAdjustmentsInputSchema>
