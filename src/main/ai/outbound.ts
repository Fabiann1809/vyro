import { sessionDigestSchema, type SessionDigest } from '@shared/coach'
import { reviewDigestSchema } from '@shared/pathReview'
import { LlmError } from './errors'
import type { ChatMessage } from './llmClient'

// The only door out. Everything that goes to an AI provider is made here, from:
//   - text (typed by the user, or fixed text from VYRO), and
//   - digests: counts, scores and rule names of training sessions.
// Nothing else exists as far as the types are concerned: there is no way to hand over a landmark,
// a picture or a piece of audio, and a digest with a field that is not listed is refused rather
// than quietly trimmed, so a mistake shows up in a test instead of leaking.

declare const sealed: unique symbol

// A message or system prompt that was made by this module. Plain strings and ChatMessage objects
// do not fit these types, which is what keeps every other file from sending anything on its own.
export interface OutboundMessage extends ChatMessage {
  readonly [sealed]: true
}
export type OutboundSystem = string & { readonly [sealed]: true }

export { sessionDigestSchema, type SessionDigest }

const MAX_SESSIONS_IN_HISTORY = 200

export type OutboundPart =
  | { kind: 'text'; text: string }
  | { kind: 'session'; digest: unknown }
  | { kind: 'history'; digests: unknown[] }
  | { kind: 'review'; digest: unknown }

export interface OutboundTurn {
  role: 'user' | 'assistant'
  parts: OutboundPart[]
}

export const textTurn = (role: OutboundTurn['role'], text: string): OutboundTurn => ({
  role,
  parts: [{ kind: 'text', text }]
})

// Generous for a chat message or a prompt, small next to even one picture.
export const MAX_TEXT_LENGTH = 20_000
export const MAX_TURNS = 80

const DATA_URL = /data:[a-z]+\/[a-z0-9.+-]+;base64,/i
// A long unbroken run of base64 characters is how an image or audio clip looks as text.
const BASE64_RUN = /[A-Za-z0-9+/]{300,}={0,2}/

function blocked(reason: string): LlmError {
  return new LlmError('blocked', { issues: [reason] })
}

function checkText(text: string): string {
  if (text.length > MAX_TEXT_LENGTH) throw blocked('The text is too long to send.')
  if (DATA_URL.test(text) || BASE64_RUN.test(text)) {
    throw blocked('The text looks like an embedded image or audio, which is never sent.')
  }
  return text
}

function digestOf(value: unknown): SessionDigest {
  const parsed = sessionDigestSchema.safeParse(value)
  if (!parsed.success) throw blocked('A session summary has fields that are not allowed to leave.')
  return parsed.data
}

// The path and how it is going. Its goal and titles are text, so they get the same check as any
// text that leaves.
function reviewOf(value: unknown): string {
  const parsed = reviewDigestSchema.safeParse(value)
  if (!parsed.success) throw blocked('A path review has fields that are not allowed to leave.')
  const { goal, steps } = parsed.data
  checkText(goal)
  steps.forEach((step) => checkText(step.title))
  return JSON.stringify(parsed.data)
}

function renderPart(part: OutboundPart): string {
  switch (part.kind) {
    case 'text':
      return checkText(part.text)
    case 'session':
      return JSON.stringify(digestOf(part.digest))
    case 'review':
      return reviewOf(part.digest)
    case 'history': {
      if (part.digests.length > MAX_SESSIONS_IN_HISTORY) throw blocked('Too many sessions to send.')
      return JSON.stringify(part.digests.map(digestOf))
    }
  }
}

export function buildSystem(instructions: string): OutboundSystem {
  return checkText(instructions) as OutboundSystem
}

export function buildMessages(turns: readonly OutboundTurn[]): OutboundMessage[] {
  if (turns.length > MAX_TURNS) throw blocked('The conversation is too long to send.')

  return turns.map(
    (turn) =>
      ({
        role: turn.role,
        content: turn.parts.map(renderPart).join('\n')
      }) as OutboundMessage
  )
}
