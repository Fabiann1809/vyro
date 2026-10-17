import { describe, expect, it } from 'vitest'
import { HAND_JOINT_INDEX, pickHand } from '@renderer/core/handJoints'
import type { HandObservation } from '@renderer/core/handFrame'
import { HAND_LANDMARK_COUNT, type Landmark } from '@renderer/core/landmarks'
import { skillChannels } from '@shared/skill/skillChannels'
import type { HandJointName } from '@shared/skill/joints'
import { validSkillInput } from '@shared/skill/skillFixtures'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import { computeMetrics, type FrameSize } from './metrics'

const FRAME: FrameSize = { width: 1000, height: 1000 }

// A hand from points given in PIXELS. Those not listed are left at the origin.
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

function metricsOf(metrics: Record<string, unknown>): ReturnType<typeof parse>['metrics'] {
  return parse({ metrics, phases: undefined }).metrics
}

function parse(overrides: Record<string, unknown>): {
  metrics: Parameters<typeof computeMetrics>[0]
} {
  const input = {
    ...validSkillInput,
    metrics: overrides['metrics'],
    phases: [
      { id: 'a', when: { m: { gt: 1 } } },
      { id: 'b', when: { m: { lt: 0 } } }
    ],
    rep: { sequence: ['a', 'b', 'a'], minDurationMs: 500 },
    rules: [{ id: 'r', severity: 'high', check: 'min(m) > 0', message: { es: 'x', en: 'x' } }]
  }
  const result = parseSkillConfig(input)
  if (!result.ok) throw new Error(result.errors.join('; '))
  return { metrics: result.skill.metrics }
}

describe('finger angle', () => {
  const finger = metricsOf({
    m: { type: 'angle', points: ['indexMcp', 'indexPip', 'indexDip'] }
  })

  it('is 180 degrees for a straight finger', () => {
    const hand = handFromPixels({
      indexMcp: [500, 600],
      indexPip: [500, 500],
      indexDip: [500, 400]
    })

    expect(computeMetrics(finger, null, null, FRAME, hand)['m']).toBeCloseTo(180)
  })

  it('is 90 degrees for a finger bent at a right angle', () => {
    const hand = handFromPixels({
      indexMcp: [500, 600],
      indexPip: [500, 500],
      indexDip: [600, 500]
    })

    expect(computeMetrics(finger, null, null, FRAME, hand)['m']).toBeCloseTo(90)
  })

  it('is measured in pixels, so the shape of the picture does not bend it', () => {
    const wide: FrameSize = { width: 2000, height: 1000 }
    const hand = handFromPixels({
      indexMcp: [500, 600],
      indexPip: [500, 500],
      indexDip: [600, 500]
    })
    const normalized = hand.map((point) => ({ ...point, x: (point.x * FRAME.width) / wide.width }))

    expect(computeMetrics(finger, null, null, wide, normalized)['m']).toBeCloseTo(90)
  })
})

describe('gap between two points', () => {
  const spread = metricsOf({
    m: {
      type: 'gap',
      from: 'indexTip',
      to: 'middleTip',
      scale: ['indexMcp', 'pinkyMcp']
    }
  })

  it('is the distance, in times the length of the scale, whatever the size of the hand', () => {
    const near = handFromPixels({
      indexTip: [400, 300],
      middleTip: [500, 300],
      indexMcp: [400, 600],
      pinkyMcp: [600, 600]
    })
    const far = handFromPixels({
      indexTip: [400, 300],
      middleTip: [450, 300],
      indexMcp: [400, 600],
      pinkyMcp: [500, 600]
    })

    expect(computeMetrics(spread, null, null, FRAME, near)['m']).toBeCloseTo(0.5)
    expect(computeMetrics(spread, null, null, FRAME, far)['m']).toBeCloseTo(0.5)
  })

  it('is null when the scale has no length', () => {
    const hand = handFromPixels({ indexTip: [1, 1], middleTip: [2, 2] })

    expect(computeMetrics(spread, null, null, FRAME, hand)['m']).toBeNull()
  })
})

describe('wrist angle, from the forearm of the body and the hand', () => {
  const wrist = metricsOf({
    m: { type: 'angle', points: ['elbow', 'handWrist', 'middleMcp'] }
  })

  it('mixes a body point with hand points', () => {
    // Elbow to the left of the wrist and the middle knuckle straight above: a right angle.
    const body = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }))
    body[13] = { x: 0.3, y: 0.5, z: 0, visibility: 0.9 } // left elbow
    const hand = handFromPixels({ handWrist: [500, 500], middleMcp: [500, 400] })

    expect(computeMetrics(wrist, body, 'left', FRAME, hand)['m']).toBeCloseTo(90)
  })
})

describe('what is missing', () => {
  const finger = metricsOf({
    m: { type: 'angle', points: ['indexMcp', 'indexPip', 'indexDip'] }
  })

  it('is null when no hand is in view', () => {
    expect(computeMetrics(finger, null, null, FRAME, null)['m']).toBeNull()
  })

  it('is null for a body metric when the body is not in view', () => {
    const body = metricsOf({ m: { type: 'tilt', from: 'hip', to: 'shoulder' } })

    expect(computeMetrics(body, null, null, FRAME, handFromPixels({}))['m']).toBeNull()
  })
})

describe('which channels a skill uses', () => {
  it('knows a skill of the body, of the hands, or of both', () => {
    expect(
      skillChannels({ metrics: metricsOf({ m: { type: 'tilt', from: 'hip', to: 'shoulder' } }) })
    ).toEqual(['body'])
    expect(
      skillChannels({
        metrics: metricsOf({ m: { type: 'angle', points: ['indexMcp', 'indexPip', 'indexDip'] } })
      })
    ).toEqual(['hands'])
    expect(
      skillChannels({
        metrics: metricsOf({ m: { type: 'angle', points: ['elbow', 'handWrist', 'middleMcp'] } })
      })
    ).toEqual(['body', 'hands'])
  })
})

describe('pickHand', () => {
  const hand = (handedness: 'left' | 'right', score: number): HandObservation => ({
    handedness,
    score,
    landmarks: []
  })

  it('takes the one asked for', () => {
    const hands = [hand('left', 0.9), hand('right', 0.8)]

    expect(pickHand(hands, 'right')?.handedness).toBe('right')
  })

  it('takes the surest one with "auto"', () => {
    expect(pickHand([hand('left', 0.6), hand('right', 0.9)], 'auto')?.handedness).toBe('right')
  })

  it('is null when the hand asked for is not there', () => {
    expect(pickHand([hand('left', 0.9)], 'right')).toBeNull()
    expect(pickHand([], 'auto')).toBeNull()
  })
})
