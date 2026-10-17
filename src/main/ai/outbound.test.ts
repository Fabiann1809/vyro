import { describe, expect, it } from 'vitest'
import { LlmError } from './errors'
import {
  buildMessages,
  buildSystem,
  MAX_TEXT_LENGTH,
  MAX_TURNS,
  textTurn,
  type OutboundMessage,
  type OutboundSystem,
  type SessionDigest
} from './outbound'

const digest: SessionDigest = {
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

function blockedBy(action: () => unknown): LlmError {
  try {
    action()
  } catch (error) {
    if (error instanceof LlmError) return error
    throw error
  }
  throw new Error('It was expected to be blocked.')
}

describe('buildMessages', () => {
  it('turns text into messages with the same role and content', () => {
    expect(
      buildMessages([textTurn('user', 'Quiero aprender yoga'), textTurn('assistant', 'Claro')])
    ).toEqual([
      { role: 'user', content: 'Quiero aprender yoga' },
      { role: 'assistant', content: 'Claro' }
    ])
  })

  it('writes a session digest as JSON with exactly its listed fields', () => {
    const [message] = buildMessages([{ role: 'user', parts: [{ kind: 'session', digest }] }])

    expect(JSON.parse(message?.content ?? '')).toEqual(digest)
  })

  it('writes a history of digests', () => {
    const [message] = buildMessages([
      { role: 'user', parts: [{ kind: 'history', digests: [digest, { ...digest, startedAt: 1 }] }] }
    ])

    expect(JSON.parse(message?.content ?? '')).toHaveLength(2)
  })

  it('puts the text and the digest of one turn together', () => {
    const [message] = buildMessages([
      {
        role: 'user',
        parts: [
          { kind: 'text', text: 'Resume mi sesión' },
          { kind: 'session', digest }
        ]
      }
    ])

    expect(message?.content).toMatch(/^Resume mi sesión\n\{/)
  })

  it('accepts ordinary long prose and ordinary links', () => {
    const prose = 'Hoy practiqué mucho. '.repeat(500)

    expect(() =>
      buildMessages([textTurn('user', `${prose} https://example.com/a/b?c=d`)])
    ).not.toThrow()
  })
})

describe('what is not allowed to leave', () => {
  // The fields a careless caller might add to a digest, each of which must stop the whole thing.
  it.each([
    ['landmarks', { landmarks: [{ x: 0.1234, y: 0.5678, z: 0.1, visibility: 0.9 }] }],
    ['a picture', { frame: 'data:image/png;base64,iVBORw0KGgo=' }],
    ['audio samples', { audio: [0.1, -0.2, 0.3] }],
    ['a name', { userName: 'Ana' }],
    ['the camera name', { cameraId: 'Integrated Webcam' }],
    ['a field that is not even listed', { whatever: 1 }]
  ])('refuses a session digest with %s', (_name, extra) => {
    const error = blockedBy(() =>
      buildMessages([
        { role: 'user', parts: [{ kind: 'session', digest: { ...digest, ...extra } }] }
      ])
    )

    expect(error.kind).toBe('blocked')
  })

  it('refuses an extra field inside a listed error entry too', () => {
    const tampered = { ...digest, errors: [{ ruleId: 'depth', count: 1, frames: [1, 2, 3] }] }

    expect(
      blockedBy(() =>
        buildMessages([{ role: 'user', parts: [{ kind: 'session', digest: tampered }] }])
      ).kind
    ).toBe('blocked')
  })

  it('refuses a history if any of its digests is not allowed', () => {
    const history = [digest, { ...digest, landmarks: [] }]

    expect(
      blockedBy(() =>
        buildMessages([{ role: 'user', parts: [{ kind: 'history', digests: history }] }])
      ).kind
    ).toBe('blocked')
  })

  it.each([
    ['something that is not an object', 'squat'],
    ['an empty skill', { ...digest, skillId: '' }],
    ['a negative count', { ...digest, repCount: -1 }],
    ['a fractional count', { ...digest, goodCount: 1.5 }],
    ['a score above 100', { ...digest, score: 101 }],
    ['text where a number goes', { ...digest, badCount: 'many' }]
  ])('refuses %s', (_name, value) => {
    expect(
      blockedBy(() =>
        buildMessages([{ role: 'user', parts: [{ kind: 'session', digest: value }] }])
      ).kind
    ).toBe('blocked')
  })

  describe('the digest of a path review', () => {
    const review = {
      goal: 'Mejorar mi sentadilla',
      daysSinceStart: 7,
      steps: [
        {
          id: 1,
          position: 1,
          title: 'Sentadilla lenta',
          kind: 'skill',
          skillId: 'squat',
          criterionSessions: 3,
          criterionScore: 80,
          state: 'current',
          counted: 1,
          attempts: 2
        }
      ],
      skills: [
        { skillId: 'squat', sessions: 2, averageScore: 70, lastScores: [60, 80], errors: [] }
      ]
    }

    it('is written as JSON with exactly its listed fields', () => {
      const [message] = buildMessages([
        { role: 'user', parts: [{ kind: 'review', digest: review }] }
      ])

      expect(JSON.parse(message?.content ?? '')).toEqual(review)
    })

    it.each([
      ['landmarks', { landmarks: [{ x: 0.1, y: 0.2 }] }],
      ['a picture', { frame: 'data:image/png;base64,AAAA' }],
      ['audio', { audio: [0.1] }]
    ])('refuses a review that carries %s', (_name, extra) => {
      expect(
        blockedBy(() =>
          buildMessages([
            { role: 'user', parts: [{ kind: 'review', digest: { ...review, ...extra } }] }
          ])
        ).kind
      ).toBe('blocked')
    })

    it('refuses a title that is really a picture', () => {
      const tampered = {
        ...review,
        steps: [{ ...review.steps[0], title: `x ${'iVBORw0KGgoAAAANSUhEUg'.repeat(20)}` }]
      }

      expect(
        blockedBy(() =>
          buildMessages([{ role: 'user', parts: [{ kind: 'review', digest: tampered }] }])
        ).kind
      ).toBe('blocked')
    })
  })

  it('refuses text that carries a picture or sound', () => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUg'.repeat(30)

    expect(
      blockedBy(() =>
        buildMessages([textTurn('user', `data:image/png;base64,${base64.slice(0, 40)}`)])
      ).kind
    ).toBe('blocked')
    expect(blockedBy(() => buildMessages([textTurn('user', `mira esto: ${base64}`)])).kind).toBe(
      'blocked'
    )
    expect(blockedBy(() => buildSystem(`audio: data:audio/wav;base64,UklGRg==`)).kind).toBe(
      'blocked'
    )
  })

  it('refuses text that is far too long, and conversations that are far too long', () => {
    expect(
      blockedBy(() => buildMessages([textTurn('user', 'a '.repeat(MAX_TEXT_LENGTH))])).kind
    ).toBe('blocked')
    expect(
      blockedBy(() =>
        buildMessages(Array.from({ length: MAX_TURNS + 1 }, () => textTurn('user', 'hola')))
      ).kind
    ).toBe('blocked')
  })

  it('does not repeat the refused content in the error', () => {
    const canary = 'canary-landmark-0.123456'

    const error = blockedBy(() =>
      buildMessages([
        { role: 'user', parts: [{ kind: 'session', digest: { ...digest, [canary]: 1 } }] }
      ])
    )

    expect(`${error.message} ${error.issues.join(' ')}`).not.toContain(canary)
  })

  it('cannot be bypassed with plain text, which the compiler refuses', () => {
    // @ts-expect-error a plain string is not an OutboundSystem
    const system: OutboundSystem = 'plain'
    // @ts-expect-error a plain object is not an OutboundMessage
    const message: OutboundMessage = { role: 'user', content: 'plain' }

    expect([system, message]).toHaveLength(2)
  })
})
