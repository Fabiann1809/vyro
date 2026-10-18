import { describe, expect, it } from 'vitest'
import { POSE_LANDMARK, type Landmark } from '@renderer/core/landmarks'
import { computeMetrics, type MetricValues } from '@renderer/engine/metrics'
import { POSE_NAMES, poseJoints, type PoseName } from '@shared/diagrams'
import { compileExpression } from '@shared/skill/expression'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { bundledSkills } from './index'

// The figures of the guides are drawn from angles. This puts each figure through the same metrics
// and rules as a person in front of the camera: the start and the end of the movement must be the
// phases of the skill, and a repetition made of them must pass every rule. If someone changes a
// threshold in a skill, or a pose, and they no longer agree, this fails.

const FRAME = { width: 100, height: 100 }

const skill = (id: string): SkillConfig => {
  const found = bundledSkills.skills.find((item) => item.id === id)
  if (!found) throw new Error(`No skill ${id}`)
  return found
}

// The joints of a pose as the 33 points of the pose model, on the right side (facing right).
function landmarksOf(name: PoseName): Landmark[] {
  const joints = poseJoints(name)
  const empty: Landmark = { x: 0, y: 0, z: 0, visibility: 0 }
  const landmarks = Array.from({ length: 33 }, () => ({ ...empty }))
  const place = (index: number, point: { x: number; y: number }): void => {
    landmarks[index] = { x: point.x / 100, y: point.y / 100, z: 0, visibility: 1 }
  }
  place(POSE_LANDMARK.RIGHT_SHOULDER, joints.shoulder)
  place(POSE_LANDMARK.RIGHT_ELBOW, joints.elbow)
  place(POSE_LANDMARK.RIGHT_WRIST, joints.wrist)
  place(POSE_LANDMARK.RIGHT_HIP, joints.hip)
  place(POSE_LANDMARK.RIGHT_KNEE, joints.knee)
  place(POSE_LANDMARK.RIGHT_ANKLE, joints.ankle)
  return landmarks
}

const measure = (id: string, name: PoseName): MetricValues =>
  computeMetrics(skill(id).metrics, landmarksOf(name), 'right', FRAME)

// The phase whose conditions all hold for these values, if any.
function phaseOf(config: SkillConfig, values: MetricValues): string | undefined {
  return config.phases.find((phase) =>
    Object.entries(phase.when).every(([metric, limits]) => {
      const value = values[metric]
      if (value === null || value === undefined) return false
      return (
        (limits.gt === undefined || value > limits.gt) &&
        (limits.lt === undefined || value < limits.lt)
      )
    })
  )?.id
}

const PAIRS = [
  { id: 'squat', start: 'squat_start', end: 'squat_bottom' },
  { id: 'pushup', start: 'pushup_top', end: 'pushup_bottom' },
  { id: 'bicep_curl', start: 'curl_down', end: 'curl_up' }
] as const satisfies ReadonlyArray<{ id: string; start: PoseName; end: PoseName }>

describe.each(PAIRS)('the figures of $id', ({ id, start, end }) => {
  const config = skill(id)
  const startValues = measure(id, start)
  const endValues = measure(id, end)

  it('are the first two phases of a repetition of the skill', () => {
    expect(phaseOf(config, startValues)).toBe(config.rep.sequence[0])
    expect(phaseOf(config, endValues)).toBe(config.rep.sequence[1])
  })

  it('make a repetition that passes every rule of the skill', () => {
    const names = Object.keys(config.metrics)
    const series = Object.fromEntries(
      names.map((name) => [
        name,
        [startValues[name], endValues[name]].filter((value): value is number => value !== null)
      ])
    )
    const context = { series, scalars: { durationMs: 3000, descentMs: 1500, ascentMs: 1500 } }

    for (const rule of config.rules) {
      const compiled = compileExpression(rule.check, names)
      if (!compiled.ok) throw new Error(compiled.error)
      expect(compiled.expression.evaluate(context), rule.id).toBe(true)
    }
  })

  it('show the angle that the pose says it has', () => {
    for (const name of [start, end]) {
      const { measured } = poseJoints(name)
      const values = measure(id, name)
      const metric = measured.joint === 'knee' ? values['knee'] : values['elbow']
      expect(metric, name).toBeCloseTo(measured.degrees, 3)
    }
  })
})

describe('every pose', () => {
  it.each(POSE_NAMES)(
    '%s stays inside the picture, with its feet or hands on the floor',
    (name) => {
      const joints = poseJoints(name)
      const points = [
        joints.head,
        joints.shoulder,
        joints.elbow,
        joints.wrist,
        joints.hip,
        joints.knee,
        joints.ankle,
        joints.toe
      ]

      for (const point of points) {
        expect(point.x).toBeGreaterThan(0)
        expect(point.x).toBeLessThan(100)
        expect(point.y).toBeGreaterThan(0)
        // Nothing goes under the floor.
        expect(point.y).toBeLessThanOrEqual(joints.floorY + 0.01)
      }
      expect(joints.head.y).toBeLessThan(joints.shoulder.y + 10)
    }
  )

  it('has the hip behind the knee in a squat, and the arms hanging in a curl', () => {
    const bottom = poseJoints('squat_bottom')
    expect(bottom.hip.x).toBeLessThan(bottom.knee.x)
    expect(bottom.shoulder.x).toBeGreaterThan(bottom.hip.x)

    const curlDown = poseJoints('curl_down')
    // The elbow stays at the side: a little in front of the shoulder, never behind it.
    expect(curlDown.elbow.x).toBeGreaterThan(curlDown.shoulder.x)
    expect(curlDown.wrist.y).toBeGreaterThan(curlDown.elbow.y)
    const curlUp = poseJoints('curl_up')
    expect(curlUp.wrist.y).toBeLessThan(curlUp.elbow.y)
  })
})
