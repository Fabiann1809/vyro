import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_COACH_TURNS,
  type CoachChatInput,
  type CoachResult,
  type CoachChatReply
} from '@shared/coach'
import {
  resetCoach,
  retryCoach,
  sendToCoach,
  useCoach,
  windowOf,
  type CoachTurn
} from './coachStore'

type Answer = CoachResult<CoachChatReply> | Error

function fakeApi(...answers: Answer[]): {
  api: Parameters<typeof sendToCoach>[0]
  inputs: CoachChatInput[]
} {
  const inputs: CoachChatInput[] = []
  const queue = [...answers]
  const chat = vi.fn((input: CoachChatInput) => {
    inputs.push(input)
    const next = queue.shift() ?? { ok: true as const, value: { reply: 'ok' } }
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
  return { api: { coach: { chat } }, inputs }
}

const reply = (text: string): Answer => ({ ok: true, value: { reply: text } })
const failure = (kind: 'network' | 'rate-limit', retryAfterSeconds?: number): Answer => ({
  ok: false,
  error: retryAfterSeconds === undefined ? { kind } : { kind, retryAfterSeconds }
})

beforeEach(resetCoach)

describe('talking to the coach', () => {
  it('adds the question and then the answer', async () => {
    const { api } = fakeApi(reply('Empieza despacio.'))

    await sendToCoach(api, 'Quiero mejorar', 'es')

    expect(useCoach.getState()).toMatchObject({
      turns: [
        { role: 'user', text: 'Quiero mejorar' },
        { role: 'assistant', text: 'Empieza despacio.' }
      ],
      pending: false,
      error: null
    })
  })

  it('sends the conversation so far and the language', async () => {
    const { api, inputs } = fakeApi(reply('uno'), reply('dos'))

    await sendToCoach(api, 'Hola', 'es')
    await sendToCoach(api, 'Gracias', 'en')

    expect(inputs[1]).toEqual({
      turns: [
        { role: 'user', text: 'Hola' },
        { role: 'assistant', text: 'uno' },
        { role: 'user', text: 'Gracias' }
      ],
      language: 'en'
    })
  })

  it('shows that it is waiting while the answer comes', async () => {
    let finish: (value: CoachResult<CoachChatReply>) => void = () => undefined
    const api = {
      coach: {
        chat: () => new Promise<CoachResult<CoachChatReply>>((resolve) => (finish = resolve))
      }
    }

    const sending = sendToCoach(api, 'Hola', 'es')
    expect(useCoach.getState().pending).toBe(true)

    finish({ ok: true, value: { reply: 'listo' } })
    await sending

    expect(useCoach.getState().pending).toBe(false)
  })

  it('does not send an empty message, nor a second one while waiting', async () => {
    const { api, inputs } = fakeApi(reply('uno'))

    await sendToCoach(api, '   ', 'es')
    const first = sendToCoach(api, 'Hola', 'es')
    await sendToCoach(api, 'Otra', 'es')
    await first

    expect(inputs).toHaveLength(1)
    expect(useCoach.getState().turns.map((turn) => turn.text)).toEqual(['Hola', 'uno'])
  })

  it('keeps the question and says what went wrong when there is no answer', async () => {
    const { api } = fakeApi(failure('rate-limit', 30))

    await sendToCoach(api, 'Hola', 'es')

    expect(useCoach.getState()).toMatchObject({
      turns: [{ role: 'user', text: 'Hola' }],
      pending: false,
      error: { kind: 'rate-limit', retryAfterSeconds: 30 }
    })
  })

  it('asks again the same question on retry, and clears the error when it works', async () => {
    const { api, inputs } = fakeApi(failure('network'), reply('ahora sí'))

    await sendToCoach(api, 'Hola', 'es')
    await retryCoach(api, 'es')

    expect(inputs[1]?.turns).toEqual([{ role: 'user', text: 'Hola' }])
    expect(useCoach.getState()).toMatchObject({ error: null })
    expect(useCoach.getState().turns.at(-1)).toEqual({ role: 'assistant', text: 'ahora sí' })
  })

  it('does not retry when there is no question waiting', async () => {
    const { api, inputs } = fakeApi(reply('uno'))
    await sendToCoach(api, 'Hola', 'es')

    await retryCoach(api, 'es')

    expect(inputs).toHaveLength(1)
  })

  it('turns an unexpected failure of the bridge into an unknown error', async () => {
    const { api } = fakeApi(new Error('boom'))

    await sendToCoach(api, 'Hola', 'es')

    expect(useCoach.getState()).toMatchObject({ pending: false, error: { kind: 'unknown' } })
  })

  it('forgets everything on reset', async () => {
    const { api } = fakeApi(reply('uno'))
    await sendToCoach(api, 'Hola', 'es')

    resetCoach()

    expect(useCoach.getState()).toEqual({ turns: [], pending: false, error: null })
  })
})

describe('windowOf', () => {
  const turn = (role: CoachTurn['role'], text: string): CoachTurn => ({ role, text })

  it('keeps a short conversation as it is', () => {
    const turns = [turn('user', 'a'), turn('assistant', 'b'), turn('user', 'c')]

    expect(windowOf(turns)).toEqual(turns)
  })

  it('keeps only the most recent turns, opening with one of the user', () => {
    const turns = Array.from({ length: MAX_COACH_TURNS + 3 }, (_, index) =>
      turn(index % 2 === 0 ? 'user' : 'assistant', String(index))
    )

    const sent = windowOf(turns)

    expect(sent.length).toBeLessThanOrEqual(MAX_COACH_TURNS)
    expect(sent[0]?.role).toBe('user')
    expect(sent.at(-1)).toEqual(turns.at(-1))
  })

  it('sends nothing when the user has said nothing', () => {
    expect(windowOf([turn('assistant', 'hola')])).toEqual([])
  })
})
