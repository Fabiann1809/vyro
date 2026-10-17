import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CoachChatInput,
  CoachChatReply,
  CoachResult,
  CoachSummaryInput,
  CoachSummaryReply
} from '@shared/coach'
import type { PlanPathInput, PlanPathResult } from '@shared/pathPlan'
import { evaluatePath } from '@shared/pathProgress'
import type { PathReview } from '@shared/pathReview'
import type { LearningPath } from '@shared/paths'
import { buildReviewDigest, type ReviewSource } from '../ai/reviewData'
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

const REVIEW_NOW = 1_000 + 3 * 24 * 60 * 60 * 1000

interface Setup {
  chat: (input: unknown) => Promise<CoachResult<CoachChatReply>>
  summarize: (input: unknown) => Promise<CoachResult<CoachSummaryReply>>
  planPath: (input: unknown) => Promise<CoachResult<PlanPathResult>>
  reviewPath: (input: unknown) => Promise<CoachResult<PathReview>>
  // The path that a review would look at; null for none.
  review: { source: ReviewSource | null }
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
  const review: Setup['review'] = { source: null }
  const { chat, summarize, planPath, reviewPath } = createCoachHandlers({
    llm,
    getSettings: () => ({ aiEnabled: enabled.value }),
    loadReview: () => review.source,
    now: () => REVIEW_NOW
  })
  return {
    chat,
    summarize,
    planPath,
    reviewPath,
    review,
    requests,
    answer: (outcome) => queue.push(outcome),
    enabled
  }
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

const session: CoachSummaryInput['session'] = {
  skillId: 'squat',
  startedAt: 1_700_000_000_000,
  durationSeconds: 600,
  repCount: 12,
  goodCount: 8,
  needsWorkCount: 3,
  badCount: 1,
  score: 79,
  errors: [
    { ruleId: 'depth', count: 4 },
    { ruleId: 'torso_lean', count: 2 }
  ]
}
const summaryInput: CoachSummaryInput = { session, language: 'es' }
const summaryReply = { summary: 'Buena sesión.', tip: 'Baja un poco más.' }

describe('coach summary handler', () => {
  it('asks for a summary and gives back the text and the tip', async () => {
    const summarizing = setup(summaryReply)

    expect(await summarizing.summarize(summaryInput)).toEqual({ ok: true, value: summaryReply })
  })

  it('uses the quick model and asks for the language of the user', async () => {
    const summarizing = setup(summaryReply)

    await summarizing.summarize({ ...summaryInput, language: 'en' })

    expect(summarizing.requests[0]?.tier).toBe('fast')
    expect(summarizing.requests[0]?.system).toContain('Write in English')
  })

  it('sends only numbers and the internal names of the skill and its rules', async () => {
    const summarizing = setup(summaryReply)

    await summarizing.summarize(summaryInput)

    const [message] = summarizing.requests[0]?.messages ?? []
    const [, json] = (message?.content ?? '').split('\n')
    const sent = JSON.parse(json ?? '') as unknown

    expect(sent).toEqual(session)
    // Every value is a number, nothing, or a short internal name: no free text can travel here.
    const leaves: unknown[] = []
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk)
      else leaves.push(value)
    }
    walk(sent)
    for (const leaf of leaves) {
      expect(leaf === null || typeof leaf === 'number' || /^[a-z0-9_]+$/.test(String(leaf))).toBe(
        true
      )
    }
  })

  it.each([
    ['landmarks', { landmarks: [{ x: 0.1, y: 0.2 }] }],
    ['a picture', { frame: 'data:image/png;base64,AAAA' }],
    ['audio', { audio: [0.1, 0.2] }],
    ['a name', { userName: 'Ana' }]
  ])('rejects a session that carries %s, and sends nothing', async (_name, extra) => {
    const summarizing = setup(summaryReply)

    const result = await summarizing.summarize({
      session: { ...session, ...extra },
      language: 'es'
    })

    expect(result).toEqual({ ok: false, error: { kind: 'invalid-input' } })
    expect(summarizing.requests).toEqual([])
  })

  it.each([
    ['text where a number goes', { ...session, goodCount: 'many' }],
    ['a score above 100', { ...session, score: 101 }],
    ['an empty skill', { ...session, skillId: '' }],
    [
      'a rule name that is a sentence',
      { ...session, errors: [{ ruleId: 'x'.repeat(65), count: 1 }] }
    ]
  ])('rejects %s', async (_name, bad) => {
    const summarizing = setup(summaryReply)

    expect(await summarizing.summarize({ session: bad, language: 'es' })).toEqual({
      ok: false,
      error: { kind: 'invalid-input' }
    })
    expect(summarizing.requests).toEqual([])
  })

  it('does not ask while the AI coach is off', async () => {
    const summarizing = setup(summaryReply)
    summarizing.enabled.value = false

    expect(await summarizing.summarize(summaryInput)).toEqual({
      ok: false,
      error: { kind: 'not-enabled' }
    })
    expect(summarizing.requests).toEqual([])
  })

  it('answers a failure as data, like the chat does', async () => {
    const failing = setup(new LlmError('rate-limit', { retryAfterSeconds: 9 }))

    expect(await failing.summarize(summaryInput)).toEqual({
      ok: false,
      error: { kind: 'rate-limit', retryAfterSeconds: 9 }
    })
  })

  it('takes turns with the chat: only one question at a time', async () => {
    let finish: (value: unknown) => void = () => undefined
    const both = setup(() => new Promise((resolve) => (finish = resolve)))
    const chatting = both.chat(input)

    expect(await both.summarize(summaryInput)).toEqual({ ok: false, error: { kind: 'busy' } })

    finish({ reply: 'listo' })
    await chatting
  })
})

const planInput: PlanPathInput = {
  turns: [{ role: 'user', text: 'Quiero mejorar mi sentadilla' }],
  language: 'es',
  skills: [{ id: 'squat', name: { es: 'Sentadilla', en: 'Squat' }, ruleIds: ['depth'] }]
}
const proposed = {
  action: 'propose',
  requirement: { channels: ['body'], objects: [], outOfScope: [] },
  path: {
    goal: 'Mejorar mi sentadilla',
    steps: [
      {
        title: 'Sentadilla lenta',
        description: 'Baja en tres segundos.',
        kind: 'skill',
        skillId: 'squat',
        criterionSessions: 3,
        criterionScore: 75
      }
    ]
  }
}

describe('coach path planning handler', () => {
  it('gives back the path that the planner proposes', async () => {
    const planning = setup(proposed)

    expect(await planning.planPath(planInput)).toEqual({
      ok: true,
      value: { kind: 'path', path: proposed.path }
    })
  })

  it('declines what cannot be coached, as a normal answer and not as an error', async () => {
    const planning = setup({
      action: 'ask',
      requirement: { channels: [], objects: [], outOfScope: ['invisible-outcome'] },
      question: '¿Qué tipo de meditación?'
    })

    expect(await planning.planPath(planInput)).toEqual({
      ok: true,
      value: { kind: 'out-of-scope', reasons: ['invisible-outcome', 'no-signal'], measurable: [] }
    })
  })

  it.each([
    ['no skills to choose from', { ...planInput, skills: [] }],
    [
      'a skill id that is not an identifier',
      { ...planInput, skills: [{ ...planInput.skills[0], id: 'Not An Id' }] }
    ],
    [
      'a conversation that ends with the coach',
      { ...planInput, turns: [{ role: 'assistant', text: 'hola' }] }
    ],
    ['a field that is not listed', { ...planInput, camera: 'x' }],
    ['something that is not an object', 'hola']
  ])('rejects %s', async (_name, bad) => {
    const planning = setup(proposed)

    expect(await planning.planPath(bad)).toEqual({ ok: false, error: { kind: 'invalid-input' } })
    expect(planning.requests).toEqual([])
  })

  it('does not ask while the AI coach is off', async () => {
    const planning = setup(proposed)
    planning.enabled.value = false

    expect(await planning.planPath(planInput)).toEqual({
      ok: false,
      error: { kind: 'not-enabled' }
    })
  })

  it('answers a failure as data, with only its kind', async () => {
    const failing = setup(new LlmError('network'))

    expect(await failing.planPath(planInput)).toEqual({ ok: false, error: { kind: 'network' } })
  })

  it('blocks a message that carries a picture', async () => {
    const planning = setup(proposed)
    const withImage = {
      ...planInput,
      turns: [{ role: 'user', text: `mira ${'iVBORw0KGgoAAAANSUhEUg'.repeat(20)}` }]
    }

    expect(await planning.planPath(withImage)).toEqual({ ok: false, error: { kind: 'blocked' } })
    expect(planning.requests).toEqual([])
  })
})

const reviewedPath: LearningPath = {
  id: 7,
  goal: 'Mejorar mi sentadilla',
  createdAt: 1_000,
  status: 'active',
  steps: [
    {
      id: 11,
      position: 1,
      title: 'Sentadilla lenta',
      description: 'Descripción que no sale',
      kind: 'skill',
      skillId: 'squat',
      criterionSessions: 3,
      criterionScore: 80,
      doneAt: null
    }
  ]
}
const reviewSource: ReviewSource = {
  current: { path: reviewedPath, progress: evaluatePath(reviewedPath, []) },
  sessions: [],
  errorsBySkill: {}
}
const reviewInput = {
  language: 'es',
  skills: [{ id: 'squat', name: { es: 'Sentadilla', en: 'Squat' }, ruleIds: ['depth'] }]
}
const reviewReply = { summary: 'Semana tranquila.', adjustments: [] }

describe('coach path review handler', () => {
  it('reviews the path being followed and gives back the review with its path', async () => {
    const reviewing = setup(reviewReply)
    reviewing.review.source = reviewSource

    expect(await reviewing.reviewPath(reviewInput)).toEqual({
      ok: true,
      value: { pathId: 7, summary: 'Semana tranquila.', adjustments: [] }
    })
  })

  it('builds the numbers itself, from what it has, and sends only those', async () => {
    const reviewing = setup(reviewReply)
    reviewing.review.source = reviewSource

    await reviewing.reviewPath(reviewInput)

    const [lead, json] = (reviewing.requests[0]?.messages[0]?.content ?? '').split('\n')
    expect(lead).toBe('Review this week of the learning path.')
    expect(JSON.parse(json ?? '')).toEqual(buildReviewDigest(reviewSource, REVIEW_NOW))
    expect(json).not.toContain('Descripción que no sale')
  })

  it('says there is no path to review, without asking the model', async () => {
    const reviewing = setup(reviewReply)

    expect(await reviewing.reviewPath(reviewInput)).toEqual({
      ok: false,
      error: { kind: 'no-path' }
    })
    expect(reviewing.requests).toEqual([])
  })

  it.each([
    ['no skills', { ...reviewInput, skills: [] }],
    ['a field that is not listed', { ...reviewInput, digest: { goal: 'x' } }],
    ['something that is not an object', 'hola']
  ])('rejects a request with %s, so the page cannot bring its own numbers', async (_name, bad) => {
    const reviewing = setup(reviewReply)
    reviewing.review.source = reviewSource

    expect(await reviewing.reviewPath(bad)).toEqual({ ok: false, error: { kind: 'invalid-input' } })
    expect(reviewing.requests).toEqual([])
  })

  it('does not ask while the AI coach is off', async () => {
    const reviewing = setup(reviewReply)
    reviewing.review.source = reviewSource
    reviewing.enabled.value = false

    expect(await reviewing.reviewPath(reviewInput)).toEqual({
      ok: false,
      error: { kind: 'not-enabled' }
    })
  })

  it('answers a failure as data', async () => {
    const failing = setup(new LlmError('rate-limit', { retryAfterSeconds: 4 }))
    failing.review.source = reviewSource

    expect(await failing.reviewPath(reviewInput)).toEqual({
      ok: false,
      error: { kind: 'rate-limit', retryAfterSeconds: 4 }
    })
  })
})
