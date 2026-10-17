import type { z } from 'zod'
import { LlmError } from './errors'

// Open models like to wrap the JSON in a markdown fence.
function withoutFence(text: string): string {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text.trim())
  return match?.[1] ?? text
}

// Turns the text the model wrote into a value that fits the schema, or says what was wrong with it.
export function parseJsonAnswer<T>(text: string, schema: z.ZodType<T>): T {
  let json: unknown
  try {
    json = JSON.parse(withoutFence(text))
  } catch {
    throw new LlmError('invalid-response', {
      rawText: text,
      issues: ['The answer is not valid JSON.']
    })
  }

  const parsed = schema.safeParse(json)
  if (parsed.success) return parsed.data

  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
  )
  throw new LlmError('invalid-response', { rawText: text, issues })
}
