import { describe, expect, it } from 'vitest'
import type { LandmarkRecording } from '@renderer/core/recording'
import { replayRecording } from '@renderer/engine/replay'
import { parseSkillConfig } from '@renderer/engine/skillLoader'
import type { SkillConfig } from '@renderer/engine/skillSchema'
import {
  recordCurlAngles,
  recordKneeAngles,
  recordPushupAngles,
  squatAngles,
  standingAngles
} from '@renderer/engine/syntheticPose'
import curlConfig from './bicep-curl.json'
import pushupConfig from './pushup.json'
import squatConfig from './squat.json'

// Targets of the spec: how often reps are counted and how often their errors are named.
const MIN_COUNT_ACCURACY = 0.9
const MIN_ERROR_ACCURACY = 0.8

const load = (input: unknown): SkillConfig => {
  const parsed = parseSkillConfig(input)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
}

// Repeatable pseudo-random numbers, so a failing run can always be reproduced.
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Variation {
  // Angle at the deepest point of the repetition.
  extremeDeg: number
  frames: number
  options: Record<string, number>
  // The rules this repetition should fail; empty for a good one.
  expected: string[]
}

interface Exercise {
  name: string
  skill: SkillConfig
  topDeg: number
  record: (angles: number[], options: Record<string, number>) => LandmarkRecording
  good: (random: () => number) => Variation
  // Ten flawed repetitions, one named mistake each, cycling through the mistakes.
  bad: Array<(random: () => number) => Variation>
}

const between = (random: () => number, low: number, high: number): number =>
  low + (high - low) * random()

const exercises: Exercise[] = [
  {
    name: 'squat',
    skill: load(squatConfig),
    topDeg: 175,
    record: (angles, options) => recordKneeAngles(angles, options),
    good: (random) => ({
      extremeDeg: between(random, 80, 97),
      frames: Math.round(between(random, 75, 130)),
      options: { trunkLeanDeg: between(random, 15, 40) },
      expected: []
    }),
    bad: [
      (random) => ({
        extremeDeg: between(random, 102, 108),
        frames: 90,
        options: { trunkLeanDeg: 25 },
        expected: ['depth']
      }),
      (random) => ({
        extremeDeg: 90,
        frames: 90,
        options: { trunkLeanDeg: between(random, 60, 72) },
        expected: ['torso_lean']
      }),
      (random) => ({
        extremeDeg: 90,
        frames: Math.round(between(random, 30, 36)),
        options: { trunkLeanDeg: 25 },
        expected: ['descent_control']
      })
    ]
  },
  {
    name: 'push-up',
    skill: load(pushupConfig),
    topDeg: 175,
    record: (angles, options) => recordPushupAngles(angles, options),
    good: (random) => ({
      extremeDeg: between(random, 65, 87),
      frames: Math.round(between(random, 70, 120)),
      options: { hipSagDeg: between(random, -8, 8) },
      expected: []
    }),
    bad: [
      (random) => ({
        extremeDeg: between(random, 94, 99),
        frames: 90,
        options: { hipSagDeg: 0 },
        expected: ['depth']
      }),
      (random) => ({
        extremeDeg: 80,
        frames: 90,
        options: { hipSagDeg: between(random, 25, 40) },
        expected: ['body_line']
      }),
      (random) => ({
        extremeDeg: 80,
        frames: Math.round(between(random, 28, 32)),
        options: { hipSagDeg: 0 },
        expected: ['descent_control']
      })
    ]
  },
  {
    name: 'bicep curl',
    skill: load(curlConfig),
    topDeg: 170,
    record: (angles, options) => recordCurlAngles(angles, options),
    good: (random) => ({
      extremeDeg: between(random, 30, 52),
      frames: Math.round(between(random, 80, 130)),
      options: { elbowDrift: between(random, 0, 0.15), swingDeg: between(random, 0, 5) },
      expected: []
    }),
    bad: [
      (random) => ({
        extremeDeg: between(random, 60, 66),
        frames: 90,
        options: {},
        expected: ['range']
      }),
      (random) => ({
        extremeDeg: 40,
        frames: 90,
        options: { elbowDrift: between(random, 0.5, 0.8) },
        expected: ['elbow_fixed']
      }),
      (random) => ({
        extremeDeg: 40,
        frames: 90,
        options: { swingDeg: between(random, 20, 30) },
        expected: ['no_swing']
      }),
      (random) => ({
        extremeDeg: 40,
        frames: Math.round(between(random, 28, 32)),
        options: {},
        expected: ['lowering_control']
      })
    ]
  }
]

// A little camera noise on every angle.
const jitter = (angles: number[], random: () => number): number[] =>
  angles.map((angle) => angle + between(random, -1.5, 1.5))

// Plays the repetitions one set at a time and compares what the engine said to what was done.
function measure(
  exercise: Exercise,
  variations: Variation[],
  random: () => number
): { repsDone: number; repsCounted: number; verdictsRight: number } {
  let repsDone = 0
  let repsCounted = 0
  let verdictsRight = 0

  for (const variation of variations) {
    const { extremeDeg, frames, options, expected } = variation
    const top = exercise.topDeg
    const rest = standingAngles(15, top)
    const angles = jitter([...rest, ...squatAngles(frames, extremeDeg, top), ...rest], random)
    const summary = replayRecording(exercise.skill, exercise.record(angles, options))

    repsDone++
    repsCounted += Math.min(summary.repCount, 1)

    const failed = summary.results[0]?.failed.map((outcome) => outcome.ruleId) ?? []
    const named = expected.every((id) => failed.includes(id))
    const noFalseAlarm = expected.length > 0 || failed.length === 0
    if (summary.repCount === 1 && named && noFalseAlarm) verdictsRight++
  }

  return { repsDone, repsCounted, verdictsRight }
}

describe.each(exercises)('accuracy of $name', (exercise) => {
  const random = seeded(exercise.name.length * 7919)
  const good = Array.from({ length: 10 }, () => exercise.good(random))
  const bad = Array.from({ length: 10 }, (_, index) => {
    const mistake = exercise.bad[index % exercise.bad.length]
    if (!mistake) throw new Error('No mistake defined')
    return mistake(random)
  })

  it('counts at least 90% of the repetitions', () => {
    const { repsDone, repsCounted } = measure(exercise, [...good, ...bad], random)

    expect(repsCounted / repsDone).toBeGreaterThanOrEqual(MIN_COUNT_ACCURACY)
  })

  it('names the mistake of at least 80% of the repetitions', () => {
    const { repsDone, verdictsRight } = measure(exercise, [...good, ...bad], random)

    expect(verdictsRight / repsDone).toBeGreaterThanOrEqual(MIN_ERROR_ACCURACY)
  })

  it('does not raise a false alarm on a well done repetition', () => {
    const { repsDone, verdictsRight } = measure(exercise, good, random)

    expect(verdictsRight).toBe(repsDone)
  })
})
