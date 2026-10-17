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
import type { AppSettings } from '@shared/settings'
import { coachSystemPrompt, summarySystemPrompt } from '../ai/coachPrompts'
import { LlmError } from '../ai/errors'
import type { LlmClient } from '../ai/llmClient'
import { generatePathTurn } from '../ai/pathGenerator'
import { buildMessages, textTurn } from '../ai/outbound'
import { generateWithRepair } from '../ai/repair'

const replySchema = z.object({ reply: z.string().min(1).max(4000) })
const summarySchema = z.object({
  summary: z.string().min(1).max(1500),
  tip: z.string().min(1).max(500)
})
const CHAT_MAX_TOKENS = 1500
const SUMMARY_MAX_TOKENS = 1000

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
  getSettings: () => Pick<AppSettings, 'aiEnabled'>
}): {
  chat: (input: unknown) => Promise<CoachResult<CoachChatReply>>
  summarize: (input: unknown) => Promise<CoachResult<CoachSummaryReply>>
  planPath: (input: unknown) => Promise<CoachResult<PlanPathResult>>
} {
  let busy = false

  // The checks every question goes through, and the way every failure is answered.
  async function guarded<Input, Answer>(
    parsed: { success: true; data: Input } | { success: false },
    ask: (input: Input) => Promise<Answer>
  ): Promise<CoachResult<Answer>> {
    if (!parsed.success) return failed('invalid-input')
    // The page cannot get an answer by skipping its own switch: it is checked here too.
    if (!deps.getSettings().aiEnabled) return failed('not-enabled')
    if (busy) return failed('busy')

    busy = true
    try {
      return { ok: true, value: await ask(parsed.data) }
    } catch (error) {
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
      guarded(planPathInputSchema.safeParse(input), (plan) => generatePathTurn(deps.llm, plan))
  }
}

export function registerCoachIpc(deps: Parameters<typeof createCoachHandlers>[0]): void {
  const handlers = createCoachHandlers(deps)

  ipcMain.handle(IPC.coachChat, (_event, input: unknown) => handlers.chat(input))
  ipcMain.handle(IPC.coachSummarize, (_event, input: unknown) => handlers.summarize(input))
  ipcMain.handle(IPC.coachPlanPath, (_event, input: unknown) => handlers.planPath(input))
}
