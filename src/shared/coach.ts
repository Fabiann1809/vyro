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
  // The person has not accepted yet what is sent and to whom.
  | 'no-consent'
  // Another question is still being answered.
  | 'busy'
  // The page sent something that is not a valid request.
  | 'invalid-input'
  // There is no path being followed that could be reviewed.
  | 'no-path'

export interface CoachError {
  kind: CoachErrorKind
  // When the provider said how long to wait, in seconds.
  retryAfterSeconds?: number
}

export type CoachResult<T> = { ok: true; value: T } | { ok: false; error: CoachError }

export const MAX_COACH_TURNS = 40
export const MAX_COACH_TURN_LENGTH = 4000

// The turns of a conversation, ending with the user's: a question is waiting for its answer.
export const coachTurnsSchema = z
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
  .refine((turns) => turns[turns.length - 1]?.role === 'user')

export const coachChatInputSchema = z
  .object({
    turns: coachTurnsSchema,
    // The language the coach answers in.
    language: z.enum(['es', 'en'])
  })
  .strict()

export type CoachChatInput = z.infer<typeof coachChatInputSchema>

export interface CoachChatReply {
  reply: string
}

const identifier = z.string().min(1).max(64)
const count = z.number().int().min(0).max(100_000)

// The numbers of one training session: the only thing about a session that may go to an AI
// provider. Strict on purpose: a field that is not listed is refused, not quietly dropped.
export const sessionDigestSchema = z
  .object({
    skillId: identifier,
    // Milliseconds since 1970.
    startedAt: z.number().int().min(0),
    durationSeconds: z.number().int().min(0).max(86_400),
    repCount: count,
    goodCount: count,
    needsWorkCount: count,
    badCount: count,
    score: z.number().int().min(0).max(100).nullable(),
    errors: z.array(z.object({ ruleId: identifier, count }).strict()).max(50)
  })
  .strict()

export type SessionDigest = z.infer<typeof sessionDigestSchema>

export const coachSummaryInputSchema = z
  .object({ session: sessionDigestSchema, language: z.enum(['es', 'en']) })
  .strict()

export type CoachSummaryInput = z.infer<typeof coachSummaryInputSchema>

export interface CoachSummaryReply {
  summary: string
  // One concrete thing to try next time.
  tip: string
}
