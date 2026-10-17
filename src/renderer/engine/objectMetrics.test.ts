import { describe, expect, it } from 'vitest'
import { HAND_JOINT_INDEX } from '@renderer/core/handJoints'
import { HAND_LANDMARK_COUNT, type Landmark } from '@renderer/core/landmarks'
import type { ObjectBox } from '@renderer/core/objectFrame'
import { skillChannels } from '@shared/skill/skillChannels'
import type { HandJointName } from '@shared/skill/joints'
import { validSkillInput } from '@shared/skill/skillFixtures'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { computeMetrics, type FrameSize } from './metrics'
import { SkillSession } from './skillSession'

const FRAME: FrameSize = { width: 1000, height: 1000 }

function skillOf(overrides: Record<string, unknown>): SkillConfig {
  const parsed = parseSkillConfig({
    ...validSkillInput,
    id: 'guitar_check',
    object: 'guitar',
    ...overrides
  })
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
}

// A box in pixels of the picture, as a fraction of it, like the loop gives it.
const box = (x: number, y: number, width: number, height: number, frame = FRAME): ObjectBox => ({
  x: x / frame.width,
  y: y / frame.height,
  width: width / frame.width,
  height: height / frame.height,
  score: 0.9
})

function handFromPixels(points: Partial<Record<HandJointName, [number, number]>>): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: HAND_LANDMARK_COUNT }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 1
  }))
  for (const [name, [x, y]] of Object.entries(points) as Array<[HandJointName, [number, number]]>) {
    landmarks[HAND_JOINT_INDEX[name]] = {
      x: x / FRAME.width,
      y: y / FRAME.height,
      z: 0,
      visibility: 1
    }
  }
  return landmarks
}

// The skills below only need some rule to be valid.
const someRule = (metric: string): Record<string, unknown> => ({
  id: 'some_rule',
  severity: 'low',
  check: `max(${metric}) >= -100`,
  message: { es: 'Regla', en: 'Rule' }
})

const placement = skillOf({
  metrics: {
    along: {
      type: 'objectOffset',
      to: 'handWrist',
      axis: 'x',
      scale: ['handWrist', 'middleMcp']
    },
    height: {
      type: 'objectOffset',
      to: 'handWrist',
      axis: 'y',
      scale: ['handWrist', 'middleMcp']
    },
    lying: { type: 'objectAspect' }
  },
  phases: [
    { id: 'near', when: { along: { lt: 1 } } },
    { id: 'far', when: { along: { gt: 3 } } }
  ],
  rep: { sequence: ['near', 'far', 'near'], minDurationMs: 100 },
  rules: [
    {
      id: 'close',
      severity: 'medium',
      check: 'max(along) <= 4',
      message: { es: 'Acerca la guitarra', en: 'Bring the guitar closer' }
    }
  ]
})

// The palm is 100 px long, from the wrist at (300, 500) to the base of the middle finger.
const hand = handFromPixels({ handWrist: [300, 500], middleMcp: [300, 400] })

describe('metrics of an object', () => {
  it('measures where the object is from a point of the hand, in palms', () => {
    // The box is centred at (500, 450): 200 px to the right and 50 px above the wrist.
    const values = computeMetrics(
      placement.metrics,
      null,
      null,
      FRAME,
      hand,
      null,
      440,
      box(400, 350, 200, 200)
    )

    expect(values['along']).toBeCloseTo(2)
    expect(values['height']).toBeCloseTo(-0.5)
  })

  it('is negative when the object is left of the point, and positive below it', () => {
    const left = computeMetrics(
      placement.metrics,
      null,
      null,
      FRAME,
      hand,
      null,
      440,
      box(0, 600, 200, 200)
    )

    expect(left['along']).toBeCloseTo(-2)
    expect(left['height']).toBeCloseTo(2)
  })

  it('measures how lying or upright the object is by its box', () => {
    const lying = computeMetrics(
      placement.metrics,
      null,
      null,
      FRAME,
      hand,
      null,
      440,
      box(0, 0, 400, 200)
    )
    const upright = computeMetrics(
      placement.metrics,
      null,
      null,
      FRAME,
      hand,
      null,
      440,
      box(0, 0, 100, 400)
    )

    expect(lying['lying']).toBeCloseTo(2)
    expect(upright['lying']).toBeCloseTo(0.25)
  })

  it('measures the box in pixels, so the shape of the picture does not bend it', () => {
    // The same box (40% wide, 20% tall) is twice as wide as tall in a square picture, and wider
    // still in a wide one.
    const wide: FrameSize = { width: 1280, height: 720 }
    const values = computeMetrics(
      placement.metrics,
      null,
      null,
      wide,
      hand,
      null,
      440,
      box(0, 0, 0.4 * wide.width, 0.2 * wide.height, wide)
    )

    expect(values['lying']).toBeCloseTo((0.4 * 1280) / (0.2 * 720))
  })

  it('cannot be measured when the object is not in view', () => {
    const values = computeMetrics(placement.metrics, null, null, FRAME, hand, null, 440, null)

    expect(values).toEqual({ along: null, height: null, lying: null })
  })

  it('cannot place the object from a hand that is not in view', () => {
    const values = computeMetrics(
      placement.metrics,
      null,
      null,
      FRAME,
      null,
      null,
      440,
      box(0, 0, 100, 100)
    )

    expect(values['along']).toBeNull()
    expect(values['lying']).toBeCloseTo(1)
  })

  it('cannot place the object when the reference has no length', () => {
    const flat = handFromPixels({ handWrist: [300, 500], middleMcp: [300, 500] })

    const values = computeMetrics(
      placement.metrics,
      null,
      null,
      FRAME,
      flat,
      null,
      440,
      box(0, 0, 100, 100)
    )

    expect(values['along']).toBeNull()
  })
})

describe('the channels of a skill with an object', () => {
  it('needs the object and the hand it is compared with', () => {
    expect(skillChannels(placement)).toEqual(['hands', 'object'])
  })

  it('needs only the object when it is judged by its own box', () => {
    const shape = skillOf({
      metrics: { lying: { type: 'objectAspect' } },
      phases: [
        { id: 'upright', when: { lying: { lt: 0.7 } } },
        { id: 'across', when: { lying: { gt: 1.5 } } }
      ],
      rep: { sequence: ['upright', 'across', 'upright'], minDurationMs: 100 },
      rules: [someRule('lying')]
    })

    expect(skillChannels(shape)).toEqual(['object'])
  })

  it('needs the body when the object is compared with the body', () => {
    const withBody = skillOf({
      metrics: {
        reach: {
          type: 'objectOffset',
          to: 'shoulder',
          axis: 'x',
          scale: ['shoulder', 'hip']
        }
      },
      phases: [
        { id: 'near', when: { reach: { lt: 0.5 } } },
        { id: 'far', when: { reach: { gt: 1 } } }
      ],
      rep: { sequence: ['near', 'far', 'near'], minDurationMs: 100 },
      rules: [someRule('reach')]
    })

    expect(skillChannels(withBody)).toEqual(['body', 'object'])
  })
})

describe('a session that looks at an object', () => {
  const shape = skillOf({
    metrics: { lying: { type: 'objectAspect' } },
    phases: [
      { id: 'upright', when: { lying: { lt: 0.7 } } },
      { id: 'across', when: { lying: { gt: 1.5 } } }
    ],
    rep: { sequence: ['upright', 'across', 'upright'], minDurationMs: 100 },
    rules: [
      {
        id: 'across_enough',
        severity: 'high',
        check: 'max(lying) >= 1.5',
        message: { es: 'Acuesta más la guitarra', en: 'Lay the guitar down more' }
      }
    ]
  })

  const upright = box(400, 200, 100, 400)
  const across = box(300, 400, 400, 100)

  function play(boxes: Array<ObjectBox | null>): SkillSession {
    const session = new SkillSession(shape, FRAME)
    boxes.forEach((object, index) =>
      session.processFrame({ timestampMs: index * 33, landmarks: null, object })
    )
    return session
  }

  it('counts a repetition from the shape of the box alone, with no body and no hand', () => {
    const frames = [
      ...Array<ObjectBox>(10).fill(upright),
      ...Array<ObjectBox>(10).fill(across),
      ...Array<ObjectBox>(10).fill(upright)
    ]

    const session = play(frames)

    expect(session.repCount).toBe(1)
    expect(session.repResults[0]?.failed).toEqual([])
  })

  it('does not judge while the object is out of view', () => {
    const session = new SkillSession(shape, FRAME)

    const output = session.processFrame({ timestampMs: 0, landmarks: null, object: null })

    expect(output.tracked).toBe(false)
    expect(session.repCount).toBe(0)
  })
})
