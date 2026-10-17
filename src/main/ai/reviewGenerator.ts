import { z } from 'zod'
import type { LearningPath } from '@shared/paths'
import type { PlanPathInput } from '@shared/pathPlan'
import {
  adjustmentProblems,
  reviewResultSchema,
  type PathReview,
  type ReviewDigest
} from '@shared/pathReview'
import type { Language } from '@shared/settings'
import type { LlmClient } from './llmClient'
import { buildMessages } from './outbound'
import { reviewPrompt } from './pathPrompts'
import { generateWithRepair } from './repair'

const REVIEW_MAX_TOKENS = 2500

// The weekly review of a path: how the week went, and what to change. What the coach proposes is
// checked against the path as it is now, and anything that cannot be applied is sent back to be
// fixed: the messages are what the coach reads when it is asked to correct itself.
export async function generateReview(
  llm: LlmClient,
  input: {
    digest: ReviewDigest
    path: LearningPath
    skills: PlanPathInput['skills']
    language: Language
  }
): Promise<PathReview> {
  const skillIds = input.skills.map((skill) => skill.id)
  const schema = reviewResultSchema.superRefine((value, context) => {
    for (const message of adjustmentProblems(input.path, value.adjustments, skillIds)) {
      context.addIssue({ code: 'custom', path: ['adjustments'], message })
    }
  })

  const result = await generateWithRepair(llm, {
    system: reviewPrompt(input.language, input.skills),
    messages: buildMessages([
      {
        role: 'user',
        parts: [
          { kind: 'text', text: 'Review this week of the learning path.' },
          { kind: 'review', digest: input.digest }
        ]
      }
    ]),
    schema: schema as z.ZodType<z.infer<typeof reviewResultSchema>>,
    tier: 'capable',
    maxTokens: REVIEW_MAX_TOKENS
  })

  return { pathId: input.path.id, ...result }
}
