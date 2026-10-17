import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { LlmError } from './errors'
import type { GenerateRequest, LlmClient } from './llmClient'
import { generateWithRepair } from './repair'
import { buildMessages, buildSystem, textTurn } from './outbound'

const schema = z.object({ name: z.string() })

const request: GenerateRequest<{ name: string }> = {
  system: buildSystem('sys'),
  messages: buildMessages([textTurn('user', 'who?')]),
  schema,
  tier: 'capable',
  maxTokens: 100
}

// Answers with the given outcomes in order: an Error is thrown, anything else is returned.
function scripted(outcomes: unknown[]): LlmClient & { seen: GenerateRequest<unknown>[] } {
  const seen: GenerateRequest<unknown>[] = []
  return {
    seen,
    generate: <T>(call: GenerateRequest<T>): Promise<T> => {
      seen.push(call as GenerateRequest<unknown>)
      const next = outcomes.shift()
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next as T)
    }
  }
}

const invalid = (rawText = '{"nme":"x"}'): LlmError =>
  new LlmError('invalid-response', { rawText, issues: ['name: Invalid input'] })

describe('generateWithRepair', () => {
  it('returns the first answer when it is valid', async () => {
    const client = scripted([{ name: 'ok' }])

    expect(await generateWithRepair(client, request)).toEqual({ name: 'ok' })
    expect(client.seen).toHaveLength(1)
  })

  it('asks again with the wrong answer and what was wrong with it', async () => {
    const client = scripted([invalid(), { name: 'fixed' }])

    expect(await generateWithRepair(client, request)).toEqual({ name: 'fixed' })
    expect(client.seen[1]?.messages).toEqual([
      { role: 'user', content: 'who?' },
      { role: 'assistant', content: '{"nme":"x"}' },
      { role: 'user', content: expect.stringContaining('- name: Invalid input') }
    ])
  })

  it('repairs without the wrong answer when there is none to show', async () => {
    const client = scripted([invalid(''), { name: 'fixed' }])

    await generateWithRepair(client, request)

    expect(client.seen[1]?.messages.map((message) => message.role)).toEqual(['user', 'user'])
  })

  it('gives up after the allowed repairs with the last error', async () => {
    const client = scripted([invalid(), invalid(), invalid()])

    await expect(generateWithRepair(client, request, 2)).rejects.toMatchObject({
      kind: 'invalid-response'
    })
    expect(client.seen).toHaveLength(3)
  })

  it.each(['rate-limit', 'auth', 'truncated', 'refused', 'no-key'] as const)(
    'does not try to repair a %s error',
    async (kind) => {
      const client = scripted([new LlmError(kind)])

      await expect(generateWithRepair(client, request)).rejects.toMatchObject({ kind })
      expect(client.seen).toHaveLength(1)
    }
  )

  it('does not touch the request it was given', async () => {
    const client = scripted([invalid(), { name: 'fixed' }])

    await generateWithRepair(client, request)

    expect(request.messages).toHaveLength(1)
  })
})
