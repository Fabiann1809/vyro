import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LlmError } from './errors'
import type { GenerateRequest } from './llmClient'
import { OpenAiCompatibleClient, type OpenAiConfig } from './openaiClient'
import { generateWithRepair } from './repair'

const KEY = 'gsk_test_1234567890'
const config: OpenAiConfig = { baseUrl: 'https://api.example.com/v1', apiKey: KEY, model: 'm-1' }

const schema = z.object({ name: z.string(), age: z.number() })
const request: GenerateRequest<z.infer<typeof schema>> = {
  system: 'Extract the person.',
  messages: [{ role: 'user', content: 'Ana is 30.' }],
  schema,
  tier: 'capable',
  maxTokens: 500
}

const completion = (content: string | null, finishReason = 'stop'): Response =>
  new Response(
    JSON.stringify({ choices: [{ message: { content }, finish_reason: finishReason }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )

const status = (code: number, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify({ error: { message: `bad key ${KEY}` } }), { status: code, headers })

type FetchCall = { url: string; headers: Headers; body: Record<string, unknown> }

// A fetch that answers with the given responses in order, and remembers what it was asked.
function scriptedFetch(...responses: Array<Response | Error>): {
  fetchFn: typeof fetch
  calls: FetchCall[]
} {
  const calls: FetchCall[] = []
  const queue = [...responses]
  const fetchFn = vi.fn<typeof fetch>((input, init) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>
    })
    const next = queue.shift()
    if (!next) throw new Error('No more responses were scripted.')
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
  return { fetchFn, calls }
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

describe('OpenAiCompatibleClient', () => {
  it('returns the answer parsed and validated', async () => {
    const { fetchFn } = scriptedFetch(completion('{"name":"Ana","age":30}'))

    const result = await new OpenAiCompatibleClient(config, fetchFn).generate(request)

    expect(result).toEqual({ name: 'Ana', age: 30 })
  })

  it('sends a chat request with the key, the model, JSON mode and the schema in the prompt', async () => {
    const { fetchFn, calls } = scriptedFetch(completion('{"name":"Ana","age":30}'))

    await new OpenAiCompatibleClient(config, fetchFn).generate(request)

    const [call] = calls
    expect(call?.url).toBe('https://api.example.com/v1/chat/completions')
    expect(call?.headers.get('authorization')).toBe(`Bearer ${KEY}`)
    expect(call?.body).toMatchObject({
      model: 'm-1',
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })
    const messages = call?.body['messages'] as Array<{ role: string; content: string }>
    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).toContain('Extract the person.')
    expect(messages[0]?.content).toContain('"age"')
    expect(messages[1]).toEqual({ role: 'user', content: 'Ana is 30.' })
  })

  it('does not double the slash when the address ends with one', async () => {
    const { fetchFn, calls } = scriptedFetch(completion('{"name":"A","age":1}'))

    await new OpenAiCompatibleClient(
      { ...config, baseUrl: 'http://localhost:11434/v1/' },
      fetchFn
    ).generate(request)

    expect(calls[0]?.url).toBe('http://localhost:11434/v1/chat/completions')
  })

  it('sends no authorization for a server that needs no key', async () => {
    const { fetchFn, calls } = scriptedFetch(completion('{"name":"A","age":1}'))

    await new OpenAiCompatibleClient({ ...config, apiKey: null }, fetchFn).generate(request)

    expect(calls[0]?.headers.has('authorization')).toBe(false)
  })

  it('reads a JSON answer wrapped in a markdown fence', async () => {
    const { fetchFn } = scriptedFetch(completion('```json\n{"name":"Ana","age":30}\n```'))

    expect(await new OpenAiCompatibleClient(config, fetchFn).generate(request)).toEqual({
      name: 'Ana',
      age: 30
    })
  })

  it('asks once more without JSON mode when the server answers 400', async () => {
    const { fetchFn, calls } = scriptedFetch(status(400), completion('{"name":"Ana","age":30}'))

    const result = await new OpenAiCompatibleClient(config, fetchFn).generate(request)

    expect(result).toEqual({ name: 'Ana', age: 30 })
    expect(calls[0]?.body).toHaveProperty('response_format')
    expect(calls[1]?.body).not.toHaveProperty('response_format')
  })

  it('gives up with a request error when the 400 stays', async () => {
    const { fetchFn, calls } = scriptedFetch(status(400), status(400))

    const error = await failure(new OpenAiCompatibleClient(config, fetchFn).generate(request))

    expect(error).toMatchObject({ kind: 'request', status: 400 })
    expect(calls).toHaveLength(2)
  })

  it('repairs an answer that does not fit the schema, with the same loop as Claude', async () => {
    const { fetchFn, calls } = scriptedFetch(
      completion('{"name":"Ana","age":"thirty"}'),
      completion('{"name":"Ana","age":30}')
    )

    const result = await generateWithRepair(new OpenAiCompatibleClient(config, fetchFn), request)

    expect(result).toEqual({ name: 'Ana', age: 30 })
    const second = calls[1]?.body['messages'] as Array<{ role: string; content: string }>
    expect(second.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(second[2]?.content).toBe('{"name":"Ana","age":"thirty"}')
    expect(second[3]?.content).toMatch(/age: /)
  })

  it('turns a 429 into a rate-limit error that says how long to wait', async () => {
    const { fetchFn } = scriptedFetch(status(429, { 'retry-after': '12' }))

    const error = await failure(new OpenAiCompatibleClient(config, fetchFn).generate(request))

    expect(error).toMatchObject({ kind: 'rate-limit', status: 429, retryAfterSeconds: 12 })
    expect(error.retryable).toBe(true)
  })

  it('turns a 429 without a wait time into a rate-limit error all the same', async () => {
    const { fetchFn } = scriptedFetch(status(429))

    const error = await failure(new OpenAiCompatibleClient(config, fetchFn).generate(request))

    expect(error.kind).toBe('rate-limit')
    expect(error.retryAfterSeconds).toBeUndefined()
  })

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [404, 'request'],
    [503, 'server']
  ])('turns an HTTP %i answer into %s without the key in the error', async (code, kind) => {
    const { fetchFn } = scriptedFetch(status(code))

    const error = await failure(new OpenAiCompatibleClient(config, fetchFn).generate(request))

    expect(error.kind).toBe(kind)
    expect(error.message).not.toContain(KEY)
  })

  it('reports an answer cut off by the token limit', async () => {
    const { fetchFn } = scriptedFetch(completion('{"name":"An', 'length'))

    expect(
      await failure(new OpenAiCompatibleClient(config, fetchFn).generate(request))
    ).toMatchObject({
      kind: 'truncated',
      rawText: '{"name":"An'
    })
  })

  it('reports a filtered answer as a refusal', async () => {
    const { fetchFn } = scriptedFetch(completion(null, 'content_filter'))

    expect(
      (await failure(new OpenAiCompatibleClient(config, fetchFn).generate(request))).kind
    ).toBe('refused')
  })

  it('reports an empty answer as invalid so that it can be asked again', async () => {
    const { fetchFn } = scriptedFetch(completion(null))

    expect(
      (await failure(new OpenAiCompatibleClient(config, fetchFn).generate(request))).kind
    ).toBe('invalid-response')
  })

  it('reports a server that does not answer JSON', async () => {
    const { fetchFn } = scriptedFetch(new Response('<html>hi</html>', { status: 200 }))

    expect(
      (await failure(new OpenAiCompatibleClient(config, fetchFn).generate(request))).kind
    ).toBe('invalid-response')
  })

  it('turns an unreachable server into a network error', async () => {
    const { fetchFn } = scriptedFetch(new TypeError('fetch failed'))

    expect(
      (await failure(new OpenAiCompatibleClient(config, fetchFn).generate(request))).kind
    ).toBe('network')
  })

  it('turns a slow server into a timeout', async () => {
    const slow = ((_input: unknown, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })) as unknown as typeof fetch

    const error = await failure(new OpenAiCompatibleClient(config, slow, 20).generate(request))

    expect(error.kind).toBe('timeout')
  })

  it('stops when the caller cancels', async () => {
    const controller = new AbortController()
    const waiting = ((_input: unknown, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })) as unknown as typeof fetch

    const pending = failure(
      new OpenAiCompatibleClient(config, waiting).generate({
        ...request,
        signal: controller.signal
      })
    )
    controller.abort()

    expect((await pending).kind).toBe('cancelled')
  })
})
