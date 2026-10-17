import { ipcMain } from 'electron'
import { z } from 'zod'
import {
  coachChatInputSchema,
  coachSummaryInputSchema,
  type CoachChatReply,
  type CoachErrorKind,
  type CoachResult,
  type CoachSummaryReply
} from '@shared/coach'
import { IPC } from '@shared/ipc'
import { planPathInputSchema, type PlanPathResult } from '@shared/pathPlan'
import { reviewPathInputSchema, type PathReview } from '@shared/pathReview'
import { generateSkillInputSchema, type GenerateSkillResult } from '@shared/skillGeneration'
import type { AppSettings } from '@shared/settings'
import { coachSystemPrompt, summarySystemPrompt } from '../ai/coachPrompts'
import { LlmError } from '../ai/errors'
import type { LlmClient } from '../ai/llmClient'
import { generatePathTurn } from '../ai/pathGenerator'
import { buildReviewDigest, type ReviewSource } from '../ai/reviewData'
import { generateReview } from '../ai/reviewGenerator'
import { generateSkill } from '../ai/skillGenerator'
import { buildMessages, textTurn } from '../ai/outbound'
import { generateWithRepair } from '../ai/repair'

const replySchema = z.object({ reply: z.string().min(1).max(4000) })
const summarySchema = z.object({
  summary: z.string().min(1).max(1500),
  tip: z.string().min(1).max(500)
})
const CHAT_MAX_TOKENS = 1500
const SUMMARY_MAX_TOKENS = 1000

// A reason to answer with a failure that is not the model's.
class CoachFailure extends Error {
  constructor(readonly kind: CoachErrorKind) {
    super(kind)
  }
}

const failed = (kind: CoachErrorKind, retryAfterSeconds?: number): CoachResult<never> => ({
  ok: false,
  error: retryAfterSeconds === undefined ? { kind } : { kind, retryAfterSeconds }
})

// What each channel does, apart from Electron so it can be tested. Failures are answered as data
// with only a kind, since an error thrown over IPC arrives as a bare message and the page needs to
// know what happened to say it in the user's language. Neither the key nor anything the provider
// wrote ever goes back.
export function createCoachHandlers(deps: {
  llm: LlmClient
  getSettings: () => Pick<AppSettings, 'aiEnabled' | 'aiConsent'>
  // The path being followed and its numbers, or null if there is none to review.
  loadReview: () => ReviewSource | null
  // The skills made later: the ids that are taken, and where a new one is kept as a draft.
  customSkills: { usedIds: () => string[]; saveDraft: (id: string, config: unknown) => void }
  now?: () => number
}): {
  chat: (input: unknown) => Promise<CoachResult<CoachChatReply>>
  summarize: (input: unknown) => Promise<CoachResult<CoachSummaryReply>>
  planPath: (input: unknown) => Promise<CoachResult<PlanPathResult>>
  reviewPath: (input: unknown) => Promise<CoachResult<PathReview>>
  generateSkill: (input: unknown) => Promise<CoachResult<GenerateSkillResult>>
} {
  let busy = false

  // The checks every question goes through, and the way every failure is answered.
  async function guarded<Input, Answer>(
    parsed: { success: true; data: Input } | { success: false },
    ask: (input: Input) => Promise<Answer>
  ): Promise<CoachResult<Answer>> {
    if (!parsed.success) return failed('invalid-input')
    // The page cannot get an answer by skipping its own switch: it is checked here too.
    const { aiEnabled, aiConsent } = deps.getSettings()
    if (!aiEnabled) return failed('not-enabled')
    // Nothing leaves the computer until the person has accepted what is sent and to whom.
    if (!aiConsent) return failed('no-consent')
    if (busy) return failed('busy')

    busy = true
    try {
      return { ok: true, value: await ask(parsed.data) }
    } catch (error) {
      if (error instanceof CoachFailure) return failed(error.kind)
      return error instanceof LlmError
        ? failed(error.kind, error.retryAfterSeconds)
        : failed('unknown')
    } finally {
      busy = false
    }
  }

  return {
    chat: (input) => {
      return guarded(coachChatInputSchema.safeParse(input), ({ turns, language }) =>
        generateWithRepair(deps.llm, {
          system: coachSystemPrompt(language),
          messages: buildMessages(turns.map((turn) => textTurn(turn.role, turn.text))),
          schema: replySchema,
          tier: 'capable',
          maxTokens: CHAT_MAX_TOKENS
        })
      )
    },

    summarize: (input) => {
      return guarded(coachSummaryInputSchema.safeParse(input), ({ session, language }) =>
        generateWithRepair(deps.llm, {
          system: summarySystemPrompt(language),
          messages: buildMessages([
            {
              role: 'user',
              parts: [
                { kind: 'text', text: 'Summarise this training session.' },
                { kind: 'session', digest: session }
              ]
            }
          ]),
          schema: summarySchema,
          tier: 'fast',
          maxTokens: SUMMARY_MAX_TOKENS
        })
      )
    },

    planPath: (input) =>
      guarded(planPathInputSchema.safeParse(input), (plan) => generatePathTurn(deps.llm, plan)),

    reviewPath: (input) =>
      guarded(reviewPathInputSchema.safeParse(input), ({ language, skills }) => {
        const source = deps.loadReview()
        if (!source) throw new CoachFailure('no-path')
        return generateReview(deps.llm, {
          digest: buildReviewDigest(source, (deps.now ?? Date.now)()),
          path: source.current.path,
          skills,
          language
        })
      }),

    generateSkill: (input) =>
      guarded(generateSkillInputSchema.safeParse(input), async (request) => {
        const result = await generateSkill(deps.llm, {
          ...request,
          existingSkillIds: [
            ...new Set([...request.existingSkillIds, ...deps.customSkills.usedIds()])
          ]
        })
        if (result.kind !== 'skill') return result

        // Kept here, in the main process: what is approved later is this, and not something the page
        // could bring back.
        deps.customSkills.saveDraft(result.skill.id, result.config)
        return { kind: 'skill', id: result.skill.id } as const
      })
  }
}

export function registerCoachIpc(deps: Parameters<typeof createCoachHandlers>[0]): void {
  const handlers = createCoachHandlers(deps)

  ipcMain.handle(IPC.coachChat, (_event, input: unknown) => handlers.chat(input))
  ipcMain.handle(IPC.coachSummarize, (_event, input: unknown) => handlers.summarize(input))
  ipcMain.handle(IPC.coachPlanPath, (_event, input: unknown) => handlers.planPath(input))
  ipcMain.handle(IPC.coachReviewPath, (_event, input: unknown) => handlers.reviewPath(input))
  ipcMain.handle(IPC.coachGenerateSkill, (_event, input: unknown) => handlers.generateSkill(input))
}
