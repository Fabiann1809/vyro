import { describe, expect, it } from 'vitest'
import { POSE_LANDMARK_COUNT, type Landmark } from '@renderer/core/landmarks'
import { JOINT_INDEX, type JointName, type Side } from '@renderer/core/side'
import { computeMetrics, type FrameSize } from './metrics'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import { validSkillInput } from '@shared/skill/skillFixtures'
import type { SkillConfig } from '@shared/skill/skillSchema'

const FRAME: FrameSize = { width: 1280, height: 720 }

// Builds a pose from joint positions given in PIXELS, like they appear in the picture.
// Joints that are not listed stay hidden (visibility 0).
function poseFromPixels(
  side: Side,
  joints: Partial<Record<JointName, [number, number]>>,
  visibility = 0.9
): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0
  }))
  for (const [name, position] of Object.entries(joints)) {
    const index = JOINT_INDEX[side][name as JointName]
    landmarks[index] = {
      x: position[0] / FRAME.width,
      y: position[1] / FRAME.height,
      z: 0,
      visibility
    }
  }
  return landmarks
}

function metricsOf(overrides: Record<string, unknown>): SkillConfig['metrics'] {
  const parsed = parseSkillConfig({ ...validSkillInput, ...overrides })
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill.metrics
}

const kneeAngle = metricsOf({
  metrics: { knee: { type: 'angle', points: ['hip', 'knee', 'ankle'] } },
  phases: [
    { id: 'up', when: { knee: { gt: 160 } } },
    { id: 'down', when: { knee: { lt: 110 } } }
  ]
})

describe('angle metric', () => {
  it('measures a straight leg as 180 degrees', () => {
    const pose = poseFromPixels('left', { hip: [600, 200], knee: [600, 400], ankle: [600, 600] })

    expect(computeMetrics(kneeAngle, pose, 'left', FRAME).knee).toBeCloseTo(180)
  })

  it('measures a right angle at the knee', () => {
    const pose = poseFromPixels('left', { hip: [600, 300], knee: [600, 450], ankle: [750, 450] })

    expect(computeMetrics(kneeAngle, pose, 'left', FRAME).knee).toBeCloseTo(90)
  })

  it('measures in pixels: a 90 degree knee stays 90 in a 16:9 frame', () => {
    // The same pose written as normalized values would not be 90 if the frame shape were ignored.
    const pose = poseFromPixels('right', { hip: [300, 100], knee: [300, 200], ankle: [400, 200] })

    expect(computeMetrics(kneeAngle, pose, 'right', FRAME).knee).toBeCloseTo(90)
  })

  it('reads the landmarks of the chosen side only', () => {
    const left = poseFromPixels('left', { hip: [600, 200], knee: [600, 400], ankle: [600, 600] })
    const right = poseFromPixels('right', { hip: [600, 300], knee: [600, 450], ankle: [750, 450] })
    const both = left.map((landmark, index) =>
      landmark.visibility > 0 ? landmark : (right[index] ?? landmark)
    )

    expect(computeMetrics(kneeAngle, both, 'left', FRAME).knee).toBeCloseTo(180)
    expect(computeMetrics(kneeAngle, both, 'right', FRAME).knee).toBeCloseTo(90)
  })

  it('is null when a needed joint is hidden', () => {
    const pose = poseFromPixels('left', { hip: [600, 200], knee: [600, 400] })

    expect(computeMetrics(kneeAngle, pose, 'left', FRAME).knee).toBeNull()
  })

  it('is null when the side asked for is the hidden one', () => {
    const pose = poseFromPixels('left', { hip: [600, 200], knee: [600, 400], ankle: [600, 600] })

    expect(computeMetrics(kneeAngle, pose, 'right', FRAME).knee).toBeNull()
  })

  it('is null when two points coincide and the angle is undefined', () => {
    const pose = poseFromPixels('left', { hip: [600, 400], knee: [600, 400], ankle: [600, 600] })

    expect(computeMetrics(kneeAngle, pose, 'left', FRAME).knee).toBeNull()
  })

  it('treats a barely visible joint as hidden', () => {
    const pose = poseFromPixels(
      'left',
      { hip: [600, 200], knee: [600, 400], ankle: [600, 600] },
      0.3
    )

    expect(computeMetrics(kneeAngle, pose, 'left', FRAME).knee).toBeNull()
  })
})

describe('tilt metric', () => {
  const torso = metricsOf({
    metrics: { torso: { type: 'tilt', from: 'hip', to: 'shoulder' }, knee: kneeAngle.knee },
    phases: [
      { id: 'up', when: { knee: { gt: 160 } } },
      { id: 'down', when: { knee: { lt: 110 } } }
    ]
  })

  it('is 0 when the shoulder is straight above the hip', () => {
    const pose = poseFromPixels('left', { hip: [600, 500], shoulder: [600, 200] })

    expect(computeMetrics(torso, pose, 'left', FRAME).torso).toBeCloseTo(0)
  })

  it('is 45 when the torso leans halfway, to either side', () => {
    const forward = poseFromPixels('left', { hip: [600, 500], shoulder: [800, 300] })
    const backward = poseFromPixels('left', { hip: [600, 500], shoulder: [400, 300] })

    expect(computeMetrics(torso, forward, 'left', FRAME).torso).toBeCloseTo(45)
    expect(computeMetrics(torso, backward, 'left', FRAME).torso).toBeCloseTo(45)
  })

  it('is null when the shoulder is hidden', () => {
    expect(
      computeMetrics(torso, poseFromPixels('left', { hip: [600, 500] }), 'left', FRAME).torso
    ).toBeNull()
  })
})

describe('offset metric', () => {
  const elbowDrift = metricsOf({
    metrics: {
      elbowDrift: {
        type: 'offset',
        from: 'shoulder',
        to: 'elbow',
        axis: 'x',
        scale: ['shoulder', 'hip']
      },
      knee: kneeAngle.knee
    },
    phases: [
      { id: 'up', when: { knee: { gt: 160 } } },
      { id: 'down', when: { knee: { lt: 110 } } }
    ]
  })

  it('is the horizontal shift divided by the length of the reference segment', () => {
    // Elbow 50 px to the right of the shoulder, torso 200 px long.
    const pose = poseFromPixels('left', {
      shoulder: [600, 200],
      elbow: [650, 350],
      hip: [600, 400]
    })

    expect(computeMetrics(elbowDrift, pose, 'left', FRAME).elbowDrift).toBeCloseTo(0.25)
  })

  it('is negative when the shift goes the other way', () => {
    const pose = poseFromPixels('left', {
      shoulder: [600, 200],
      elbow: [560, 350],
      hip: [600, 400]
    })

    expect(computeMetrics(elbowDrift, pose, 'left', FRAME).elbowDrift).toBeCloseTo(-0.2)
  })

  it('does not depend on how far the person stands from the camera', () => {
    const near = poseFromPixels('left', {
      shoulder: [600, 200],
      elbow: [650, 350],
      hip: [600, 400]
    })
    const far = poseFromPixels('left', { shoulder: [600, 300], elbow: [625, 375], hip: [600, 400] })

    expect(computeMetrics(elbowDrift, near, 'left', FRAME).elbowDrift).toBeCloseTo(
      computeMetrics(elbowDrift, far, 'left', FRAME).elbowDrift ?? NaN
    )
  })

  it('can measure along the vertical axis', () => {
    const vertical = metricsOf({
      metrics: {
        wristHeight: {
          type: 'offset',
          from: 'shoulder',
          to: 'wrist',
          axis: 'y',
          scale: ['shoulder', 'hip']
        },
        knee: kneeAngle.knee
      },
      phases: [
        { id: 'up', when: { knee: { gt: 160 } } },
        { id: 'down', when: { knee: { lt: 110 } } }
      ]
    })
    const pose = poseFromPixels('left', {
      shoulder: [600, 200],
      wrist: [600, 300],
      hip: [600, 400]
    })

    expect(computeMetrics(vertical, pose, 'left', FRAME).wristHeight).toBeCloseTo(0.5)
  })

  it('is null when the reference segment has no length', () => {
    const pose = poseFromPixels('left', {
      shoulder: [600, 200],
      elbow: [650, 350],
      hip: [600, 200]
    })

    expect(computeMetrics(elbowDrift, pose, 'left', FRAME).elbowDrift).toBeNull()
  })

  it('is null when a joint is hidden', () => {
    const pose = poseFromPixels('left', { shoulder: [600, 200], hip: [600, 400] })

    expect(computeMetrics(elbowDrift, pose, 'left', FRAME).elbowDrift).toBeNull()
  })
})

describe('several metrics at once', () => {
  it('measures each one on its own, so one hidden joint does not spoil the others', () => {
    const metrics = metricsOf({})
    const pose = poseFromPixels('left', {
      shoulder: [600, 200],
      hip: [600, 500],
      knee: [600, 700]
      // no ankle: the knee angle cannot be measured, but the torso tilt can
    })

    const values = computeMetrics(metrics, pose, 'left', FRAME)

    expect(values.knee).toBeNull()
    expect(values.torso).toBeCloseTo(0)
  })

  it('returns exactly one entry per metric of the skill', () => {
    const values = computeMetrics(metricsOf({}), poseFromPixels('left', {}), 'left', FRAME)

    expect(Object.keys(values).sort()).toEqual(['knee', 'kneeDrift', 'torso'])
  })
})
