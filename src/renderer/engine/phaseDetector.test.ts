import { describe, expect, it } from 'vitest'
import { PhaseDetector } from './phaseDetector'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import { validSkillInput } from '@shared/skill/skillFixtures'
import type { SkillConfig } from '@shared/skill/skillSchema'

function skillFrom(input: Record<string, unknown>): SkillConfig {
  const parsed = parseSkillConfig(input)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
}

// Squat: "up" above 160 degrees, "down" below 110 degrees, with a dead band in between.
const squat = skillFrom(validSkillInput)

// Two phases that touch at 150 degrees: the worst case for flickering.
const touching = skillFrom({
  ...validSkillInput,
  phases: [
    { id: 'up', when: { knee: { gt: 150 } } },
    { id: 'down', when: { knee: { lt: 150 } } }
  ]
})

const knee = (value: number | null): Record<string, number | null> => ({
  knee: value,
  torso: 0,
  kneeDrift: 0
})

// Feeds a series of knee angles and returns the phase after each one.
function run(detector: PhaseDetector, angles: Array<number | null>): Array<string | null> {
  return angles.map((angle) => detector.update(knee(angle)).phase)
}

describe('PhaseDetector', () => {
  it('has no phase before the body reaches one', () => {
    const detector = new PhaseDetector(squat)

    expect(detector.update(knee(130))).toEqual({ phase: null, previous: null, changed: false })
  })

  it('enters a phase when its conditions hold and reports the change', () => {
    const detector = new PhaseDetector(squat)

    expect(detector.update(knee(170))).toEqual({ phase: 'up', previous: null, changed: true })
    expect(detector.update(knee(172))).toEqual({ phase: 'up', previous: 'up', changed: false })
  })

  it('moves from one phase to the other and tells where it came from', () => {
    const detector = new PhaseDetector(squat)
    detector.update(knee(170))

    expect(detector.update(knee(100))).toEqual({ phase: 'down', previous: 'up', changed: true })
  })

  it('keeps the last phase while the body is in the dead band between two phases', () => {
    const detector = new PhaseDetector(squat)

    expect(run(detector, [170, 150, 130, 115])).toEqual(['up', 'up', 'up', 'up'])
  })

  it('does not flicker when the measure jitters around a threshold', () => {
    const detector = new PhaseDetector(squat)

    // 161, 159, 162, 158 all sit within 5 degrees of the 160 threshold.
    expect(run(detector, [170, 161, 159, 162, 158, 160, 157])).toEqual(Array(7).fill('up'))
  })

  it('does not flicker where two phases touch', () => {
    const detector = new PhaseDetector(touching)
    detector.update(knee(160))

    // Jitter of a few degrees around the shared 150 boundary.
    expect(run(detector, [151, 149, 152, 148, 150, 147])).toEqual(Array(6).fill('up'))
  })

  it('switches where two phases touch once the margin is crossed', () => {
    const detector = new PhaseDetector(touching)
    detector.update(knee(160))

    expect(run(detector, [148, 144, 140])).toEqual(['up', 'down', 'down'])
    expect(run(detector, [152, 154, 156])).toEqual(['down', 'down', 'up'])
  })

  it('needs every condition of a phase to hold', () => {
    const strict = skillFrom({
      ...validSkillInput,
      phases: [
        { id: 'up', when: { knee: { gt: 160 }, torso: { lt: 30 } } },
        { id: 'down', when: { knee: { lt: 110 } } }
      ]
    })
    const detector = new PhaseDetector(strict)

    expect(detector.update({ knee: 170, torso: 50, kneeDrift: 0 }).phase).toBeNull()
    expect(detector.update({ knee: 170, torso: 20, kneeDrift: 0 }).phase).toBe('up')
  })

  it('keeps the phase when a metric cannot be measured', () => {
    const detector = new PhaseDetector(squat)

    expect(run(detector, [170, null, null, 172])).toEqual(['up', 'up', 'up', 'up'])
  })

  it('does not enter a phase from a missing measure', () => {
    const detector = new PhaseDetector(squat)

    expect(run(detector, [null, null])).toEqual([null, null])
  })

  it('forgets the phase on reset', () => {
    const detector = new PhaseDetector(squat)
    detector.update(knee(170))
    detector.reset()

    expect(detector.update(knee(130)).phase).toBeNull()
  })

  it('counts exactly one change per real movement in a noisy squat', () => {
    const detector = new PhaseDetector(squat)
    let seed = 11
    const noise = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return (seed / 4294967296 - 0.5) * 8 // ±4 degrees
    }

    // Three squats: 175° standing down to 90° and back, sampled at 30 fps over 2 s each.
    const changes: string[] = []
    for (let rep = 0; rep < 3; rep++) {
      for (let frame = 0; frame < 60; frame++) {
        const angle = 132.5 + 42.5 * Math.cos((2 * Math.PI * frame) / 60) + noise()
        const update = detector.update(knee(angle))
        if (update.changed && update.phase) changes.push(update.phase)
      }
    }

    expect(changes).toEqual(['up', 'down', 'up', 'down', 'up', 'down', 'up'])
  })
})
