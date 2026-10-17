import { LlmError } from './errors'
import type { GenerateRequest, LlmClient } from './llmClient'

const DEFAULT_REPAIRS = 2

// Asks again when the model answered with something that does not fit the schema, telling it
// what was wrong. Any other failure is not the model's to fix and goes straight up.
export async function generateWithRepair<T>(
  client: LlmClient,
  request: GenerateRequest<T>,
  maxRepairs: number = DEFAULT_REPAIRS
): Promise<T> {
  let current = request

  for (let repairs = 0; ; repairs++) {
    try {
      return await client.generate(current)
    } catch (error) {
      if (
        !(error instanceof LlmError) ||
        error.kind !== 'invalid-response' ||
        repairs >= maxRepairs
      ) {
        throw error
      }
      current = { ...request, messages: [...request.messages, ...repairTurns(error)] }
    }
  }
}

function repairTurns(error: LlmError): GenerateRequest<unknown>['messages'] {
  const problems = error.issues.map((issue) => `- ${issue}`).join('\n')
  const fix = {
    role: 'user' as const,
    content: `Your answer did not match the required format:\n${problems}\nAnswer again with only the corrected JSON.`
  }
  return error.rawText ? [{ role: 'assistant', content: error.rawText }, fix] : [fix]
}
