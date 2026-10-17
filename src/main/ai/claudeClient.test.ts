import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  ClaudeClient,
  createSdkTransport,
  type ClaudeRequest,
  type ClaudeResponse,
  type ClaudeTransport
} from './claudeClient'
import { LlmError } from './errors'
import type { GenerateRequest } from './llmClient'
import { buildMessages, buildSystem, textTurn } from './outbound'

const KEY = 'sk-ant-test-1234567890'

const schema = z.object({ name: z.string(), age: z.number() })
const request: GenerateRequest<z.infer<typeof schema>> = {
  system: buildSystem('Extract the person.'),
  messages: buildMessages([textTurn('user', 'Ana is 30.')]),
  schema,
  tier: 'capable',
  maxTokens: 500
}

const answer = (
  text: string,
  stopReason: ClaudeResponse['stop_reason'] = 'end_turn'
): ClaudeResponse =>
  ({
    content: [{ type: 'text', text, citations: null }],
    stop_reason: stopReason
  }) as ClaudeResponse

function clientWith(transport: ClaudeTransport, key: string | null = KEY): ClaudeClient {
  return new ClaudeClient(
    () => key,
    () => transport
  )
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

describe('ClaudeClient with a fake transport', () => {
  it('returns the answer parsed and validated', async () => {
    const client = clientWith(() => Promise.resolve(answer('{"name":"Ana","age":30}')))

    expect(await client.generate(request)).toEqual({ name: 'Ana', age: 30 })
  })

  it('asks the capable model for what must be right and the fast one for what is short', async () => {
    const transport = vi.fn<ClaudeTransport>(() => Promise.resolve(answer('{"name":"A","age":1}')))
    const client = clientWith(transport)

    await client.generate(request)
    await client.generate({ ...request, tier: 'fast' })

    expect(transport.mock.calls.map(([sent]) => sent.model)).toEqual([
      'claude-sonnet-5-5',
      'claude-haiku-5-5'
    ])
  })

  it('asks for a JSON answer that follows the schema, with no sampling or thinking settings', async () => {
    const transport = vi.fn<ClaudeTransport>(() => Promise.resolve(answer('{"name":"A","age":1}')))

    await clientWith(transport).generate(request)

    const sent = transport.mock.calls[0]?.[0] as ClaudeRequest
    expect(sent.output_config?.format?.type).toBe('json_schema')
    expect(sent).toMatchObject({ max_tokens: 500, system: 'Extract the person.' })
    expect(sent).not.toHaveProperty('temperature')
    expect(sent).not.toHaveProperty('thinking')
  })

  it('fails with no-key, without calling the provider, when there is no key', async () => {
    const transport = vi.fn<ClaudeTransport>()

    const error = await failure(clientWith(transport, null).generate(request))

    expect(error.kind).toBe('no-key')
    expect(transport).not.toHaveBeenCalled()
  })

  it('reads the key when the request is made, not when the client is built', async () => {
    let key: string | null = null
    const client = new ClaudeClient(
      () => key,
      () => () => Promise.resolve(answer('{"name":"A","age":1}'))
    )

    await expect(client.generate(request)).rejects.toMatchObject({ kind: 'no-key' })
    key = KEY

    expect(await client.generate(request)).toEqual({ name: 'A', age: 1 })
  })

  it('reports a refusal', async () => {
    const client = clientWith(() => Promise.resolve(answer('', 'refusal')))

    expect((await failure(client.generate(request))).kind).toBe('refused')
  })

  it('reports a truncated answer as such, keeping what arrived', async () => {
    const client = clientWith(() => Promise.resolve(answer('{"name":"An', 'max_tokens')))

    expect(await failure(client.generate(request))).toMatchObject({
      kind: 'truncated',
      rawText: '{"name":"An'
    })
  })

  it('reports text that is not JSON, keeping it for the repair', async () => {
    const client = clientWith(() => Promise.resolve(answer('Sure! Here it is')))

    expect(await failure(client.generate(request))).toMatchObject({
      kind: 'invalid-response',
      rawText: 'Sure! Here it is',
      issues: ['The answer is not valid JSON.']
    })
  })

  it('reports JSON that does not fit the schema, saying where', async () => {
    const client = clientWith(() => Promise.resolve(answer('{"name":"Ana","age":"thirty"}')))

    const error = await failure(client.generate(request))

    expect(error.kind).toBe('invalid-response')
    expect(error.issues).toEqual([expect.stringMatching(/^age: /)])
  })

  it('turns a provider failure into a typed error that does not hold the key', async () => {
    const providerError = Object.assign(new Error(`invalid x-api-key ${KEY}`), { status: 401 })
    const client = clientWith(() => Promise.reject(providerError))

    const error = await failure(client.generate(request))

    expect(error.kind).toBe('auth')
    expect(error.message).not.toContain(KEY)
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(KEY)
  })
})

describe('ClaudeClient with the real SDK and a fake network', () => {
  const okBody = {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: [{ type: 'text', text: '{"name":"Ana","age":30}' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 }
  }

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  const clientWithFetch = (fakeFetch: typeof fetch): ClaudeClient =>
    new ClaudeClient(
      () => KEY,
      (key) => createSdkTransport(key, { maxRetries: 0, fetch: fakeFetch })
    )

  it('sends a well formed request and reads the answer', async () => {
    const fakeFetch = vi.fn<typeof fetch>(() => Promise.resolve(json(okBody)))

    expect(await clientWithFetch(fakeFetch).generate(request)).toEqual({ name: 'Ana', age: 30 })

    const [url, init] = fakeFetch.mock.calls[0] ?? []
    const headers = new Headers(init?.headers)
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(String(url)).toContain('/v1/messages')
    expect(headers.get('x-api-key')).toBe(KEY)
    expect(body['model']).toBe('claude-sonnet-5-5')
    expect(body['output_config']).toMatchObject({
      effort: 'medium',
      format: { type: 'json_schema' }
    })
    expect(body).not.toHaveProperty('temperature')
  })

  it.each([
    [401, 'auth'],
    [429, 'rate-limit'],
    [529, 'server'],
    [400, 'request']
  ])('turns an HTTP %i answer into %s', async (status, kind) => {
    const fakeFetch = (): Promise<Response> =>
      Promise.resolve(
        json({ type: 'error', error: { type: 'x', message: `bad key ${KEY}` } }, status)
      )

    const error = await failure(clientWithFetch(fakeFetch as typeof fetch).generate(request))

    expect(error.kind).toBe(kind)
    expect(error.message).not.toContain(KEY)
  })

  it('turns an unreachable network into a network error', async () => {
    const fakeFetch = (): Promise<Response> => Promise.reject(new TypeError('fetch failed'))

    const error = await failure(clientWithFetch(fakeFetch as typeof fetch).generate(request))

    expect(error.kind).toBe('network')
    expect(error.retryable).toBe(true)
  })
})
