import { z } from 'zod'
import { assessFeasibility, skillRequirementSchema } from '@shared/feasibility'
import { pathToSaveSchema } from '@shared/paths'
import { MAX_QUESTIONS, type PlanPathInput, type PlanPathResult } from '@shared/pathPlan'
import type { LlmClient } from './llmClient'
import { buildMessages, textTurn } from './outbound'
import { pathPlannerPrompt } from './pathPrompts'
import { generateWithRepair } from './repair'

const PLAN_MAX_TOKENS = 4000

const ask = z
  .object({
    action: z.literal('ask'),
    requirement: skillRequirementSchema,
    question: z.string().trim().min(1).max(400)
  })
  .strict()

const noMatchingSkill = z
  .object({ action: z.literal('no-matching-skill'), requirement: skillRequirementSchema })
  .strict()

const proposeBase = z
  .object({
    action: z.literal('propose'),
    requirement: skillRequirementSchema,
    path: pathToSaveSchema
  })
  .strict()

// What the model can answer with.
export type PlanTurn =
  z.infer<typeof ask> | z.infer<typeof proposeBase> | z.infer<typeof noMatchingSkill>

// What the model may answer. A path may only use skills that exist and must have something to
// measure; the messages say what to fix, because they are what the model reads when it is asked to
// correct its answer. Once the questions are used up, asking is not an option any more.
export function planTurnSchema(skillIds: readonly string[], canAsk: boolean): z.ZodType<PlanTurn> {
  const propose = proposeBase.superRefine((value, context) => {
    value.path.steps.forEach((step, index) => {
      if (step.kind === 'skill' && !skillIds.includes(step.skillId)) {
        context.addIssue({
          code: 'custom',
          path: ['path', 'steps', index, 'skillId'],
          message: `Unknown skill "${step.skillId}". Use one of: ${skillIds.join(', ')}.`
        })
      }
    })
    if (!value.path.steps.some((step) => step.kind === 'skill')) {
      context.addIssue({
        code: 'custom',
        path: ['path', 'steps'],
        message: 'The path needs at least one step with kind "skill".'
      })
    }
  })

  return canAsk
    ? z.discriminatedUnion('action', [ask, propose, noMatchingSkill])
    : z.discriminatedUnion('action', [propose, noMatchingSkill])
}

// One step of the planning conversation. The model describes what the skill needs and what it
// proposes; this function decides, with the rule of the scope, what the user gets to see.
export async function generatePathTurn(
  llm: LlmClient,
  input: PlanPathInput
): Promise<PlanPathResult> {
  const questionsAsked = input.turns.filter((turn) => turn.role === 'assistant').length
  const canAsk = questionsAsked < MAX_QUESTIONS

  const turn = await generateWithRepair(llm, {
    system: pathPlannerPrompt(input, canAsk),
    messages: buildMessages(input.turns.map((item) => textTurn(item.role, item.text))),
    schema: planTurnSchema(
      input.skills.map((skill) => skill.id),
      canAsk
    ),
    tier: 'capable',
    maxTokens: PLAN_MAX_TOKENS
  })

  // First, whether VYRO can coach it at all: this needs no more questions and no path.
  const feasibility = assessFeasibility(turn.requirement)
  if (feasibility.verdict === 'out-of-scope') {
    return {
      kind: 'out-of-scope',
      reasons: feasibility.reasons,
      measurable: feasibility.measurable
    }
  }
  if (feasibility.verdict === 'planned') {
    return {
      kind: 'planned',
      pending: feasibility.channels
        .filter((assessment) => assessment.status === 'planned')
        .map(({ channel, phase }) => ({ channel, phase })),
      measurable: feasibility.measurable
    }
  }

  switch (turn.action) {
    case 'ask':
      return { kind: 'question', question: turn.question }
    case 'propose':
      return { kind: 'path', path: turn.path }
    case 'no-matching-skill':
      return { kind: 'no-matching-skill' }
  }
}
