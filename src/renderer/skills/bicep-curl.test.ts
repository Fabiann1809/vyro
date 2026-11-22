import { describe, expect, it } from 'vitest'
import { replayRecording } from '@renderer/engine/replay'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { recordCurlAngles, squatAngles, standingAngles } from '@renderer/engine/syntheticPose'
import curlConfig from './bicep-curl.json'

const curl: SkillConfig = (() => {
  const parsed = parseSkillConfig(curlConfig)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

// A calm curl: three seconds from the arm hanging, curled up and back down.
const rep = (topDeg = 40, frames = 90): number[] => squatAngles(frames, topDeg, 170)

const session = (reps: number[][]): number[] => [
  ...standingAngles(15, 170),
  ...reps.flat(),
  ...standingAngles(15, 170)
]

const failedRules = (
  angles: number[],
  options: { elbowDrift?: number; swingDeg?: number } = {}
): string[][] =>
  replayRecording(curl, recordCurlAngles(angles, options)).results.map((result) =>
    result.failed.map((outcome) => outcome.ruleId)
  )

describe('bicep curl skill', () => {
  it('counts every repetition of a well done set', () => {
    const summary = replayRecording(curl, recordCurlAngles(session([rep(), rep(), rep()])))

    expect(summary.repCount).toBe(3)
    expect(summary.results.map((result) => result.quality)).toEqual(['good', 'good', 'good'])
    expect(summary.feedback.map((entry) => entry.message.kind)).not.toContain('correction')
  })

  it('catches a curl that does not go high enough', () => {
    expect(failedRules(session([rep(40), rep(65), rep(40)]))).toEqual([[], ['range'], []])
  })

  it('catches an elbow that travels forward', () => {
    expect(failedRules(session([rep(), rep()]), { elbowDrift: 0.6 })).toEqual([
      ['elbow_fixed'],
      ['elbow_fixed']
    ])
  })

  it('catches a body that swings to help the arm', () => {
    expect(failedRules(session([rep(), rep()]), { swingDeg: 25 })).toEqual([
      ['no_swing'],
      ['no_swing']
    ])
  })

  it('accepts a little movement of the elbow and body', () => {
    expect(failedRules(session([rep(), rep()]), { elbowDrift: 0.1, swingDeg: 4 })).toEqual([[], []])
  })

  it('catches dropping the weight too fast', () => {
    expect(failedRules(session([rep(40, 90), rep(40, 33)]))).toEqual([[], ['lowering_control']])
  })

  it('still counts the curl when the model doubts the wrist and the elbow at the top', () => {
    const recording = recordCurlAngles(session([rep(), rep(), rep()]))
    const doubtful = {
      ...recording,
      frames: recording.frames.map((frame) => ({
        ...frame,
        // Both wrists and both elbows, whichever side is the near one: seen at 0.35 out of 1.
        landmarks:
          frame.landmarks?.map((landmark, index) =>
            [13, 14, 15, 16].includes(index) && landmark[3] > 0.5
              ? ([landmark[0], landmark[1], landmark[2], 0.35] as typeof landmark)
              : landmark
          ) ?? null
      }))
    }

    expect(replayRecording(curl, doubtful).repCount).toBe(3)
  })

  it('counts a curl that stops a little short of the old limits, as a laptop camera sees it', () => {
    expect(replayRecording(curl, recordCurlAngles(session([rep(75), rep(75)]))).repCount).toBe(2)
  })

  it('does not count a person who only stands', () => {
    const summary = replayRecording(curl, recordCurlAngles(standingAngles(150, 170)))

    expect(summary.repCount).toBe(0)
  })
})
