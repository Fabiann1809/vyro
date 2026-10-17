import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AI_PROVIDER_IDS, type AiProviderId } from '@shared/aiProviders'
import { ConfiguredLlmClient } from './provider'
import { generateWithRepair } from './repair'
import { buildMessages, buildSystem, textTurn } from './outbound'

// A check against a real provider, for whoever has a key. It is skipped unless the key is in the
// environment, so the normal test run never touches the network or needs a secret:
//
//   VYRO_LIVE_PROVIDER=groq VYRO_LIVE_API_KEY=... pnpm vitest run src/main/ai/live.test.ts
//
// Optional: VYRO_LIVE_MODEL, and VYRO_LIVE_BASE_URL for the "custom" provider. Ollama needs no key:
// use VYRO_LIVE_API_KEY=none with VYRO_LIVE_PROVIDER=ollama.
const provider = (process.env['VYRO_LIVE_PROVIDER'] ?? 'groq') as AiProviderId
const apiKey = process.env['VYRO_LIVE_API_KEY']

describe.skipIf(!apiKey || !AI_PROVIDER_IDS.includes(provider))('live provider', () => {
  it('answers a request with a value that fits the schema', async () => {
    const client = new ConfiguredLlmClient(
      () => ({
        aiProvider: provider,
        aiModel: process.env['VYRO_LIVE_MODEL'] ?? null,
        aiBaseUrl: process.env['VYRO_LIVE_BASE_URL'] ?? null
      }),
      () => (apiKey === 'none' ? null : (apiKey ?? null))
    )

    const person = await generateWithRepair(client, {
      system: buildSystem('Extract the person mentioned in the text.'),
      messages: buildMessages([textTurn('user', 'Ana is 30 years old.')]),
      schema: z.object({ name: z.string(), age: z.number() }),
      tier: 'fast',
      maxTokens: 2000
    })

    expect(person.age).toBe(30)
    expect(person.name).toContain('Ana')
  }, 120_000)
})
