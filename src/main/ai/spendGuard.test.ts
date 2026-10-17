import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { AiUsageRepository } from '../db/aiUsageRepository'
import { openDatabase } from '../db/database'
import { LlmError } from './errors'
import type { GenerateRequest, LlmClient } from './llmClient'
import { buildMessages, buildSystem, textTurn } from './outbound'
import {
  dayOf,
  MAX_OUTPUT_TOKENS_PER_REQUEST,
  SpendLimitedClient,
  type SpendLedger
} from './spendGuard'

const NOON = new Date(2026, 9, 17, 12).getTime()

function request(text = 'hola', maxTokens = 1000): GenerateRequest<{ reply: string }> {
  return {
    system: buildSystem('You are a coach.'),
    messages: buildMessages([textTurn('user', text)]),
    schema: z.object({ reply: z.string() }),
    tier: 'fast',
    maxTokens
  }
}

function setup(options: { limit?: number; inner?: LlmClient['generate'] } = {}): {
  client: SpendLimitedClient
  generate: ReturnType<typeof vi.fn>
  ledger: SpendLedger
} {
  const generate = vi.fn(options.inner ?? (() => Promise.resolve({ reply: 'ok' })))
  const ledger = new AiUsageRepository(openDatabase(':memory:'))
  const client = new SpendLimitedClient(
    { generate } as unknown as LlmClient,
    ledger,
    () => options.limit ?? 1000,
    () => NOON
  )
  return { client, generate, ledger }
}

describe('SpendLimitedClient', () => {
  it('passes the answer through and counts what was used', async () => {
    const { client, ledger } = setup()

    expect(await client.generate(request())).toEqual({ reply: 'ok' })

    expect(ledger.tokensOn(dayOf(NOON))).toBeGreaterThan(0)
  })

  it('does not call the provider once the day limit is reached', async () => {
    const { client, generate, ledger } = setup({ limit: 500 })
    ledger.add(dayOf(NOON), 500)

    await expect(client.generate(request())).rejects.toMatchObject({ kind: 'limit-reached' })

    expect(generate).not.toHaveBeenCalled()
  })

  it('stops after the request that crosses the limit, and not before', async () => {
    const { client, generate, ledger } = setup({ limit: 100 })
    ledger.add(dayOf(NOON), 99)

    await client.generate(request())
    await expect(client.generate(request())).rejects.toMatchObject({ kind: 'limit-reached' })

    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('starts again on the next day', async () => {
    const { client, ledger } = setup({ limit: 100 })
    ledger.add(dayOf(NOON - 24 * 3600 * 1000), 100)

    expect(await client.generate(request())).toEqual({ reply: 'ok' })
  })

  it('caps the answer size, whatever the caller asks for', async () => {
    const { client, generate } = setup()

    await client.generate(request('hola', 50_000))

    const sent = generate.mock.calls[0]?.[0] as GenerateRequest<unknown>
    expect(sent.maxTokens).toBe(MAX_OUTPUT_TOKENS_PER_REQUEST)
  })

  it('keeps a smaller size the caller asked for', async () => {
    const { client, generate } = setup()

    await client.generate(request('hola', 300))

    expect((generate.mock.calls[0]?.[0] as GenerateRequest<unknown>).maxTokens).toBe(300)
  })

  it('refuses a request that is too large, without calling the provider', async () => {
    const { client, generate } = setup({ limit: 10_000_000 })
    const huge = Array.from({ length: 10 }, () => textTurn('user', 'a b '.repeat(4900)))

    await expect(
      client.generate({ ...request(), messages: buildMessages(huge) })
    ).rejects.toMatchObject({ kind: 'too-large' })

    expect(generate).not.toHaveBeenCalled()
  })

  it('counts a failure that did reach the provider, but not one that never left', async () => {
    const failing = (kind: 'server' | 'blocked') => (): Promise<never> =>
      Promise.reject(new LlmError(kind))

    const reached = setup({ inner: failing('server') })
    await expect(reached.client.generate(request())).rejects.toBeInstanceOf(LlmError)
    expect(reached.ledger.tokensOn(dayOf(NOON))).toBeGreaterThan(0)

    const notSent = setup({ inner: failing('blocked') })
    await expect(notSent.client.generate(request())).rejects.toBeInstanceOf(LlmError)
    expect(notSent.ledger.tokensOn(dayOf(NOON))).toBe(0)
  })
})
