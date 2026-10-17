import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AI_PROVIDER_IDS, type AiProviderId } from '@shared/aiProviders'
import { ClaudeClient, createSdkTransport } from './claudeClient'
import type { GenerateRequest } from './llmClient'
import { buildMessages, buildSystem, textTurn, type SessionDigest } from './outbound'
import { ConfiguredLlmClient } from './provider'

// What actually leaves the app, seen from the network, for every provider.

const KEY = 'secret-key-1234567890'
const schema = z.object({ summary: z.string() })

const digest: SessionDigest = {
  skillId: 'squat',
  startedAt: 1_700_000_000_000,
  durationSeconds: 600,
  repCount: 12,
  goodCount: 8,
  needsWorkCount: 3,
  badCount: 1,
  score: 79,
  errors: [{ ruleId: 'depth', count: 4 }]
}

interface Sent {
  url: string
  headers: Headers
  body: Record<string, unknown>
}

// A network that records everything and answers like the provider whose address it was given.
function recordingNetwork(): { fetchFn: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = []
  const fetchFn = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    sent.push({
      url,
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>
    })
    const answer = JSON.stringify({ summary: 'ok' })
    const body = url.includes('/v1/messages')
      ? {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'm',
          content: [{ type: 'text', text: answer }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 }
        }
      : { choices: [{ message: { content: answer }, finish_reason: 'stop' }] }
    return Promise.resolve(
      new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
    )
  }) as typeof fetch
  return { fetchFn, sent }
}

function clientFor(provider: AiProviderId, fetchFn: typeof fetch): ConfiguredLlmClient {
  const getKey = (): string | null => (provider === 'ollama' ? null : KEY)
  return new ConfiguredLlmClient(
    () => ({ aiProvider: provider, aiModel: 'm', aiBaseUrl: 'https://llm.example.com/v1' }),
    getKey,
    new ClaudeClient(getKey, (apiKey) =>
      createSdkTransport(apiKey, { maxRetries: 0, fetch: fetchFn })
    ),
    fetchFn
  )
}

const goodRequest = (): GenerateRequest<z.infer<typeof schema>> => ({
  system: buildSystem('Summarise the session for the user.'),
  messages: buildMessages([
    {
      role: 'user',
      parts: [
        { kind: 'text', text: 'How did I do?' },
        { kind: 'session', digest }
      ]
    }
  ]),
  schema,
  tier: 'fast',
  maxTokens: 500
})

// The fields a request to each kind of server is allowed to have.
const ALLOWED_BODY_KEYS = new Set([
  'model',
  'max_tokens',
  'system',
  'messages',
  'output_config',
  'response_format'
])

// Standard HTTP headers only: nothing that describes the computer or the user.
const ALLOWED_HEADER =
  /^(content-type|accept|authorization|x-api-key|anthropic-version|user-agent|connection|accept-encoding|accept-language|sec-fetch-mode)$/

describe.each(AI_PROVIDER_IDS)('what leaves the app towards %s', (provider) => {
  it('is a request with only the allowed fields, to the expected place', async () => {
    const { fetchFn, sent } = recordingNetwork()

    await clientFor(provider, fetchFn).generate(goodRequest())

    expect(sent).toHaveLength(1)
    const [request] = sent
    expect(Object.keys(request?.body ?? {}).filter((key) => !ALLOWED_BODY_KEYS.has(key))).toEqual(
      []
    )
    expect(new URL(request?.url ?? '').search).toBe('')
  })

  it('carries the digest numbers and the question, and nothing about the camera or the body', async () => {
    const { fetchFn, sent } = recordingNetwork()

    await clientFor(provider, fetchFn).generate(goodRequest())

    const wire = JSON.stringify(sent[0]?.body)
    expect(wire).toContain('How did I do?')
    expect(wire).toContain('\\"repCount\\":12')
    for (const forbidden of [
      'landmark',
      'visibility',
      'data:image',
      'data:audio',
      'cameraId',
      'deviceId'
    ]) {
      expect(wire, forbidden).not.toContain(forbidden)
    }
  })

  it('keeps the key in the authorization header only', async () => {
    const { fetchFn, sent } = recordingNetwork()

    await clientFor(provider, fetchFn).generate(goodRequest())

    const [request] = sent
    expect(JSON.stringify(request?.body)).not.toContain(KEY)
    expect(request?.url).not.toContain(KEY)
    const headerNames = [...(request?.headers.keys() ?? [])]
    expect(headerNames.filter((name) => !ALLOWED_HEADER.test(name))).toEqual([])
    if (provider === 'ollama') expect(request?.headers.has('authorization')).toBe(false)
  })

  it('never even reaches the network when the data is not allowed', async () => {
    const { fetchFn, sent } = recordingNetwork()
    const client = clientFor(provider, fetchFn)

    const tamper = (): GenerateRequest<z.infer<typeof schema>> => ({
      ...goodRequest(),
      messages: buildMessages([
        {
          role: 'user',
          parts: [
            {
              kind: 'session',
              digest: {
                ...digest,
                landmarks: [{ x: 0.123456, y: 0.654321 }],
                frame: 'data:image/png;base64,AAAA',
                audio: [0.1, 0.2]
              }
            }
          ]
        }
      ])
    })

    expect(() => client.generate(tamper())).toThrow(
      expect.objectContaining({ kind: 'blocked' }) as never
    )
    expect(sent).toEqual([])
  })
})

describe('the only way to make something to send', () => {
  it('cannot produce a message from text that carries a picture', () => {
    expect(() =>
      buildMessages([textTurn('user', `data:image/jpeg;base64,${'A'.repeat(500)}`)])
    ).toThrow()
  })
})
