import { z } from 'zod'

// Why a request to the AI coach did not give an answer. The page turns each into a message in the
// user's language; none of them carries text from the provider.
export type LlmErrorKind =
  | 'no-key'
  | 'auth'
  | 'rate-limit'
  | 'timeout'
  | 'network'
  | 'server'
  | 'request'
  | 'refused'
  | 'cancelled'
  // The provider choice is incomplete or unsafe (for example, a custom provider without a model).
  | 'not-configured'
  // The data to send did not pass the privacy check, so nothing was sent.
  | 'blocked'
  // The model answered, but not with what the schema asks for. Worth asking again.
  | 'invalid-response'
  // The answer was cut off by the token limit: asking again as is would cut it off again.
  | 'truncated'
  | 'unknown'

export type CoachErrorKind =
  | LlmErrorKind
  // The user has not turned the AI coach on.
  | 'not-enabled'
  // Another question is still being answered.
  | 'busy'
  // The page sent something that is not a valid request.
  | 'invalid-input'

export interface CoachError {
  kind: CoachErrorKind
  // When the provider said how long to wait, in seconds.
  retryAfterSeconds?: number
}

export type CoachResult<T> = { ok: true; value: T } | { ok: false; error: CoachError }

export const MAX_COACH_TURNS = 40
export const MAX_COACH_TURN_LENGTH = 4000

export const coachChatInputSchema = z
  .object({
    turns: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            text: z.string().trim().min(1).max(MAX_COACH_TURN_LENGTH)
          })
          .strict()
      )
      .min(1)
      .max(MAX_COACH_TURNS)
      // A question is waiting for its answer: the last word is the user's.
      .refine((turns) => turns[turns.length - 1]?.role === 'user'),
    // The language the coach answers in.
    language: z.enum(['es', 'en'])
  })
  .strict()

export type CoachChatInput = z.infer<typeof coachChatInputSchema>

export interface CoachChatReply {
  reply: string
}
