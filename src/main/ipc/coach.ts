import { ipcMain } from 'electron'
import { z } from 'zod'
import {
  coachChatInputSchema,
  type CoachChatReply,
  type CoachErrorKind,
  type CoachResult
} from '@shared/coach'
import { IPC } from '@shared/ipc'
import type { AppSettings } from '@shared/settings'
import { coachSystemPrompt } from '../ai/coachPrompts'
import { LlmError } from '../ai/errors'
import type { LlmClient } from '../ai/llmClient'
import { buildMessages, textTurn } from '../ai/outbound'
import { generateWithRepair } from '../ai/repair'

const replySchema = z.object({ reply: z.string().min(1).max(4000) })
const CHAT_MAX_TOKENS = 1500

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
}): { chat: (input: unknown) => Promise<CoachResult<CoachChatReply>> } {
  let busy = false

  return {
    chat: async (input) => {
      const parsed = coachChatInputSchema.safeParse(input)
      if (!parsed.success) return failed('invalid-input')
      // The page cannot get an answer by skipping its own switch: it is checked here too.
      if (!deps.getSettings().aiEnabled) return failed('not-enabled')
      if (busy) return failed('busy')

      busy = true
      try {
        const { turns, language } = parsed.data
        const value = await generateWithRepair(deps.llm, {
          system: coachSystemPrompt(language),
          messages: buildMessages(turns.map((turn) => textTurn(turn.role, turn.text))),
          schema: replySchema,
          tier: 'capable',
          maxTokens: CHAT_MAX_TOKENS
        })
        return { ok: true, value }
      } catch (error) {
        return error instanceof LlmError
          ? failed(error.kind, error.retryAfterSeconds)
          : failed('unknown')
      } finally {
        busy = false
      }
    }
  }
}

export function registerCoachIpc(deps: Parameters<typeof createCoachHandlers>[0]): void {
  const handlers = createCoachHandlers(deps)

  ipcMain.handle(IPC.coachChat, (_event, input: unknown) => handlers.chat(input))
}
