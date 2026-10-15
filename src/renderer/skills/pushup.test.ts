import { describe, expect, it } from 'vitest'
import { replayRecording } from '@renderer/engine/replay'
import { parseSkillConfig } from '@renderer/engine/skillLoader'
import type { SkillConfig } from '@renderer/engine/skillSchema'
import { recordPushupAngles, squatAngles, standingAngles } from '@renderer/engine/syntheticPose'
import pushupConfig from './pushup.json'

const pushup: SkillConfig = (() => {
  const parsed = parseSkillConfig(pushupConfig)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

// A calm push-up: three seconds from arms straight, down and back up.
const rep = (bottomDeg = 80, frames = 90): number[] => squatAngles(frames, bottomDeg, 175)

const session = (reps: number[][]): number[] => [
  ...standingAngles(15),
  ...reps.flat(),
  ...standingAngles(15)
]

const failedRules = (angles: number[], hipSagDeg = 0): string[][] =>
  replayRecording(pushup, recordPushupAngles(angles, { hipSagDeg })).results.map((result) =>
    result.failed.map((outcome) => outcome.ruleId)
  )

describe('push-up skill', () => {
  it('counts every repetition of a well done set', () => {
    const summary = replayRecording(pushup, recordPushupAngles(session([rep(), rep(), rep()])))

    expect(summary.repCount).toBe(3)
    expect(summary.results.map((result) => result.quality)).toEqual(['good', 'good', 'good'])
    expect(summary.feedback.map((entry) => entry.message.kind)).not.toContain('correction')
  })

  it('catches a push-up that is not deep enough', () => {
    expect(failedRules(session([rep(80), rep(95), rep(80)]))).toEqual([[], ['depth'], []])
  })

  it('catches hips that sag', () => {
    expect(failedRules(session([rep(), rep()]), 30)).toEqual([['body_line'], ['body_line']])
  })

  it('catches hips that rise', () => {
    expect(failedRules(session([rep()]), -30)).toEqual([['body_line']])
  })

  it('accepts a body that is nearly straight', () => {
    expect(failedRules(session([rep(), rep()]), 8)).toEqual([[], []])
  })

  it('catches dropping down too fast', () => {
    expect(failedRules(session([rep(80, 90), rep(80, 30)]))).toEqual([[], ['descent_control']])
  })

  it('does not count a person who only holds the plank', () => {
    const summary = replayRecording(pushup, recordPushupAngles(standingAngles(150)))

    expect(summary.repCount).toBe(0)
  })
})
