import { describe, expect, it } from 'vitest'
import { replayRecording } from '@renderer/engine/replay'
import { parseSkillConfig } from '@renderer/engine/skillLoader'
import type { SkillConfig } from '@renderer/engine/skillSchema'
import { recordKneeAngles, squatAngles, standingAngles } from '@renderer/engine/syntheticPose'
import squatConfig from './squat.json'

const squat: SkillConfig = (() => {
  const parsed = parseSkillConfig(squatConfig)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

// A calm squat: three seconds from standing, down and back up.
const rep = (bottomDeg = 90, frames = 90): number[] => squatAngles(frames, bottomDeg)

const session = (reps: number[][]): number[] => [
  ...standingAngles(15),
  ...reps.flat(),
  ...standingAngles(15)
]

const failedRules = (angles: number[], trunkLeanDeg = 0): string[][] =>
  replayRecording(squat, recordKneeAngles(angles, { trunkLeanDeg })).results.map((result) =>
    result.failed.map((outcome) => outcome.ruleId)
  )

describe('squat skill', () => {
  it('is a valid skill with a message in both languages for every rule', () => {
    expect(squat.id).toBe('squat')
    expect(squat.rules.length).toBeGreaterThanOrEqual(3)
  })

  it('counts every repetition of a well done set', () => {
    const summary = replayRecording(squat, recordKneeAngles(session([rep(), rep(), rep(), rep()])))

    expect(summary.repCount).toBe(4)
    expect(summary.results.map((result) => result.quality)).toEqual([
      'good',
      'good',
      'good',
      'good'
    ])
    expect(summary.feedback.map((entry) => entry.message.kind)).not.toContain('correction')
  })

  it('catches a squat that is not deep enough', () => {
    expect(failedRules(session([rep(90), rep(105), rep(90)]))).toEqual([[], ['depth'], []])
  })

  it('judges a missed depth as a bad repetition', () => {
    const summary = replayRecording(squat, recordKneeAngles(session([rep(106)])))

    expect(summary.results[0]?.quality).toBe('bad')
    expect(summary.feedback[0]?.message).toMatchObject({ ruleId: 'depth' })
  })

  it('catches a torso that leans too far forward', () => {
    expect(failedRules(session([rep(), rep()]), 65)).toEqual([['torso_lean'], ['torso_lean']])
  })

  it('accepts the natural lean of a good squat', () => {
    expect(failedRules(session([rep(), rep()]), 35)).toEqual([[], []])
  })

  it('catches dropping down too fast', () => {
    expect(failedRules(session([rep(90, 90), rep(90, 36)]))).toEqual([[], ['descent_control']])
  })

  it('reports the most severe problem first when several happen at once', () => {
    const summary = replayRecording(
      squat,
      recordKneeAngles(session([rep(106, 36)]), { trunkLeanDeg: 65 })
    )

    expect(summary.results[0]?.failed.map((outcome) => outcome.ruleId)).toEqual([
      'depth',
      'torso_lean',
      'descent_control'
    ])
    expect(summary.feedback[0]?.message).toMatchObject({ ruleId: 'depth' })
  })

  it('does not count a person who only stands', () => {
    const summary = replayRecording(squat, recordKneeAngles(standingAngles(150)))

    expect(summary.repCount).toBe(0)
  })
})
