import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoachChatInput, CoachResult, CoachChatReply } from '@shared/coach'
import { LlmError } from '../ai/errors'
import type { GenerateRequest, LlmClient } from '../ai/llmClient'
import { createCoachHandlers } from './coach'

// The handlers do not need Electron, but the module imports it.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

const KEY = 'sk-secret-1234567890'
const input: CoachChatInput = {
  turns: [{ role: 'user', text: 'Quiero mejorar mi sentadilla' }],
  language: 'es'
}

interface Setup {
  chat: (input: unknown) => Promise<CoachResult<CoachChatReply>>
  requests: GenerateRequest<unknown>[]
  answer: (outcome: unknown) => void
  enabled: { value: boolean }
}

// A model that answers with the outcomes it is given in order: an Error is thrown, any other
// value is returned, and a function is called to get one (so a test can hold the answer back).
function setup(...outcomes: unknown[]): Setup {
  const requests: GenerateRequest<unknown>[] = []
  const queue = [...outcomes]
  const enabled = { value: true }
  const llm: LlmClient = {
    generate: <T>(request: GenerateRequest<T>): Promise<T> => {
      requests.push(request as GenerateRequest<unknown>)
      const next = queue.shift()
      const value = typeof next === 'function' ? (next as () => unknown)() : next
      return value instanceof Error ? Promise.reject(value) : Promise.resolve(value as T)
    }
  }
  const { chat } = createCoachHandlers({ llm, getSettings: () => ({ aiEnabled: enabled.value }) })
  return { chat, requests, answer: (outcome) => queue.push(outcome), enabled }
}

let ctx: Setup

beforeEach(() => {
  ctx = setup({ reply: 'Empieza con diez sentadillas lentas.' })
})

describe('coach chat handler', () => {
  it('asks the model and gives back its answer', async () => {
    expect(await ctx.chat(input)).toEqual({
      ok: true,
      value: { reply: 'Empieza con diez sentadillas lentas.' }
    })
  })

  it('sends the conversation as it is, with an instruction to answer in the language asked', async () => {
    await ctx.chat({
      turns: [
        { role: 'user', text: 'Hola' },
        { role: 'assistant', text: 'Hola, ¿qué practicamos?' },
        { role: 'user', text: 'Sentadilla' }
      ],
      language: 'en'
    })

    const [request] = ctx.requests
    expect(request?.messages.map((message) => [message.role, message.content])).toEqual([
      ['user', 'Hola'],
      ['assistant', 'Hola, ¿qué practicamos?'],
      ['user', 'Sentadilla']
    ])
    expect(request?.system).toContain('Always answer in English.')
    expect(request?.tier).toBe('capable')
  })

  it('answers in Spanish when the page asks for Spanish', async () => {
    await ctx.chat(input)

    expect(ctx.requests[0]?.system).toContain('Always answer in Spanish.')
  })

  it('does not ask the model while the AI coach is off', async () => {
    ctx.enabled.value = false

    expect(await ctx.chat(input)).toEqual({ ok: false, error: { kind: 'not-enabled' } })
    expect(ctx.requests).toEqual([])
  })

  it.each([
    ['something that is not an object', 'hola'],
    ['no conversation', { turns: [], language: 'es' }],
    [
      'a conversation that ends with the coach',
      { turns: [{ role: 'assistant', text: 'x' }], language: 'es' }
    ],
    ['an empty message', { turns: [{ role: 'user', text: '   ' }], language: 'es' }],
    ['a made-up role', { turns: [{ role: 'system', text: 'x' }], language: 'es' }],
    ['an unknown language', { turns: [{ role: 'user', text: 'x' }], language: 'fr' }],
    ['a field that is not listed', { ...input, camera: 'frame-data' }],
    [
      'an extra field in a message',
      { turns: [{ role: 'user', text: 'x', image: 'y' }], language: 'es' }
    ],
    [
      'a message that is far too long',
      { turns: [{ role: 'user', text: 'a'.repeat(5000) }], language: 'es' }
    ]
  ])('rejects %s', async (_name, bad) => {
    expect(await ctx.chat(bad)).toEqual({ ok: false, error: { kind: 'invalid-input' } })
    expect(ctx.requests).toEqual([])
  })

  it('blocks a message that carries a picture, and sends nothing', async () => {
    const withImage = {
      turns: [{ role: 'user', text: `mira ${'iVBORw0KGgoAAAANSUhEUg'.repeat(20)}` }],
      language: 'es'
    }

    expect(await ctx.chat(withImage)).toEqual({ ok: false, error: { kind: 'blocked' } })
    expect(ctx.requests).toEqual([])
  })

  it('asks again when the model answers in the wrong format', async () => {
    const repairing = setup(
      new LlmError('invalid-response', {
        rawText: '{"respuesta":"x"}',
        issues: ['reply: Required']
      }),
      { reply: 'Ahora sí.' }
    )

    expect(await repairing.chat(input)).toEqual({ ok: true, value: { reply: 'Ahora sí.' } })
    expect(repairing.requests).toHaveLength(2)
  })

  it('answers a failure as data: its kind, and how long to wait if the provider said so', async () => {
    const limited = setup(new LlmError('rate-limit', { status: 429, retryAfterSeconds: 12 }))

    expect(await limited.chat(input)).toEqual({
      ok: false,
      error: { kind: 'rate-limit', retryAfterSeconds: 12 }
    })
  })

  it.each(['no-key', 'auth', 'network', 'timeout', 'server', 'refused', 'not-configured'] as const)(
    'passes on a %s error with only its kind',
    async (kind) => {
      const failing = setup(new LlmError(kind, { rawText: 'the model wrote this', status: 500 }))

      expect(await failing.chat(input)).toEqual({ ok: false, error: { kind } })
    }
  )

  it('turns any other failure into "unknown" without its message', async () => {
    const crashing = setup(new Error(`boom with key ${KEY}`))

    const result = await crashing.chat(input)

    expect(result).toEqual({ ok: false, error: { kind: 'unknown' } })
    expect(JSON.stringify(result)).not.toContain(KEY)
  })

  it('never gives back what the model wrote when it was wrong', async () => {
    const wrong = setup(
      new LlmError('invalid-response', { rawText: 'SECRET-MODEL-OUTPUT', issues: ['x'] }),
      new LlmError('invalid-response', { rawText: 'SECRET-MODEL-OUTPUT', issues: ['x'] }),
      new LlmError('invalid-response', { rawText: 'SECRET-MODEL-OUTPUT', issues: ['x'] })
    )

    const result = await wrong.chat(input)

    expect(result).toEqual({ ok: false, error: { kind: 'invalid-response' } })
    expect(JSON.stringify(result)).not.toContain('SECRET-MODEL-OUTPUT')
  })

  it('refuses a second question while the first is still being answered', async () => {
    let finish: (value: unknown) => void = () => undefined
    const slow = setup(() => new Promise((resolve) => (finish = resolve)))
    // The model's answer is a promise here; hand it over as the value to wait for.
    const first = slow.chat(input)

    expect(await slow.chat(input)).toEqual({ ok: false, error: { kind: 'busy' } })

    finish({ reply: 'listo' })
    await first
  })

  it('can be asked again after an answer or a failure', async () => {
    const twice = setup(new LlmError('network'), { reply: 'ok' })

    expect((await twice.chat(input)).ok).toBe(false)
    expect((await twice.chat(input)).ok).toBe(true)
  })
})
