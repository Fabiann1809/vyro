import type { z } from 'zod'

// Which kind of model a request needs. Each provider maps it to one of its own models, in one place.
//   fast     short, cheap answers such as a session summary
//   capable  answers that must be right: learning paths and generated skills
export type ModelTier = 'fast' | 'capable'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GenerateRequest<T> {
  system: string
  messages: ChatMessage[]
  // The answer must fit this schema; the client returns the parsed, validated value.
  schema: z.ZodType<T>
  tier: ModelTier
  maxTokens: number
  signal?: AbortSignal
}

// What the rest of the app talks to. Providers (Claude, OpenAI-compatible) implement it, and every
// failure is an LlmError so callers do not depend on any provider's exceptions.
export interface LlmClient {
  generate: <T>(request: GenerateRequest<T>) => Promise<T>
}
