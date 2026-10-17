import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LlmError } from './errors'
import type { GenerateRequest, LlmClient } from './llmClient'
import { ConfiguredLlmClient, type ProviderChoice } from './provider'
import { buildMessages, buildSystem, textTurn } from './outbound'

const KEY = 'gsk_test_1234567890'
const schema = z.object({ ok: z.boolean() })
const request: GenerateRequest<z.infer<typeof schema>> = {
  system: buildSystem('s'),
  messages: buildMessages([textTurn('user', 'hi')]),
  schema,
  tier: 'capable',
  maxTokens: 100
}

const choice = (overrides: Partial<ProviderChoice> = {}): ProviderChoice => ({
  aiProvider: 'claude',
  aiModel: null,
  aiBaseUrl: null,
  ...overrides
})

const okFetch = (): {
  fetchFn: typeof fetch
  urls: string[]
  bodies: Array<Record<string, unknown>>
} => {
  const urls: string[] = []
  const bodies: Array<Record<string, unknown>> = []
  const fetchFn = vi.fn<typeof fetch>((input, init) => {
    urls.push(String(input))
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    return Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }))
    )
  })
  return { fetchFn, urls, bodies }
}

function clientFor(
  current: ProviderChoice,
  key: string | null = KEY
): { client: ConfiguredLlmClient; claude: LlmClient; net: ReturnType<typeof okFetch> } {
  const claude: LlmClient = {
    generate: vi.fn(() => Promise.resolve({ ok: true })) as LlmClient['generate']
  }
  const net = okFetch()
  return {
    client: new ConfiguredLlmClient(
      () => current,
      () => key,
      claude,
      net.fetchFn
    ),
    claude,
    net
  }
}

async function failure(promise: Promise<unknown>): Promise<LlmError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof LlmError) return error
    throw error
  }
  throw new Error('It was expected to fail.')
}

describe('ConfiguredLlmClient', () => {
  it('sends Claude requests to the Claude client', async () => {
    const { client, claude, net } = clientFor(choice())

    await client.generate(request)

    expect(claude.generate).toHaveBeenCalledOnce()
    expect(net.urls).toEqual([])
  })

  it('sends Groq requests to its address with the model of the request kind', async () => {
    const { client, net } = clientFor(choice({ aiProvider: 'groq' }))

    await client.generate(request)
    await client.generate({ ...request, tier: 'fast' })

    expect(net.urls[0]).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(net.bodies.map((body) => body['model'])).toEqual([
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b'
    ])
  })

  it('uses Gemini’s compatible address', async () => {
    const { client, net } = clientFor(choice({ aiProvider: 'gemini' }))

    await client.generate(request)

    expect(net.urls[0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    )
  })

  it('prefers the model the user typed, for every kind of request', async () => {
    const { client, net } = clientFor(choice({ aiProvider: 'groq', aiModel: 'my-model' }))

    await client.generate(request)
    await client.generate({ ...request, tier: 'fast' })

    expect(net.bodies.map((body) => body['model'])).toEqual(['my-model', 'my-model'])
  })

  it('works with Ollama without a key', async () => {
    const { client, net } = clientFor(choice({ aiProvider: 'ollama' }), null)

    await client.generate(request)

    expect(net.urls[0]).toBe('http://localhost:11434/v1/chat/completions')
  })

  it.each(['claude', 'groq', 'gemini', 'custom'] as const)(
    'asks for a key before calling %s',
    async (aiProvider) => {
      const { client, net, claude } = clientFor(
        choice({ aiProvider, aiModel: 'm', aiBaseUrl: 'https://x.example.com/v1' }),
        null
      )

      expect((await failure(client.generate(request))).kind).toBe('no-key')
      expect(net.urls).toEqual([])
      expect(claude.generate).not.toHaveBeenCalled()
    }
  )

  it('needs a model and an address for a custom provider', async () => {
    const noModel = clientFor(
      choice({ aiProvider: 'custom', aiBaseUrl: 'https://x.example.com/v1' })
    )
    const noAddress = clientFor(choice({ aiProvider: 'custom', aiModel: 'm' }))

    expect((await failure(noModel.client.generate(request))).kind).toBe('not-configured')
    expect((await failure(noAddress.client.generate(request))).kind).toBe('not-configured')
  })

  it('works with a complete custom provider', async () => {
    const { client, net } = clientFor(
      choice({ aiProvider: 'custom', aiModel: 'm', aiBaseUrl: 'https://x.example.com/v1' })
    )

    await client.generate(request)

    expect(net.urls[0]).toBe('https://x.example.com/v1/chat/completions')
  })

  it('never sends the key over plain HTTP to another computer', async () => {
    const { client, net } = clientFor(
      choice({ aiProvider: 'custom', aiModel: 'm', aiBaseUrl: 'http://evil.example.com/v1' })
    )

    expect((await failure(client.generate(request))).kind).toBe('not-configured')
    expect(net.urls).toEqual([])
  })

  it('follows a change of provider made between two requests', async () => {
    let current = choice()
    const claude: LlmClient = {
      generate: vi.fn(() => Promise.resolve({ ok: true })) as LlmClient['generate']
    }
    const net = okFetch()
    const client = new ConfiguredLlmClient(
      () => current,
      () => KEY,
      claude,
      net.fetchFn
    )

    await client.generate(request)
    current = choice({ aiProvider: 'groq' })
    await client.generate(request)

    expect(claude.generate).toHaveBeenCalledOnce()
    expect(net.urls).toHaveLength(1)
  })
})
