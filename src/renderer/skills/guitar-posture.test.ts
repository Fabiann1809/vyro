import { describe, expect, it } from 'vitest'
import { replayRecording } from '@renderer/engine/replay'
import { guitaristPose, recordPoses } from '@renderer/engine/syntheticPose'
import { skillChannels } from '@shared/skill/skillChannels'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import postureConfig from './guitar-posture.json'

const posture: SkillConfig = (() => {
  const parsed = parseSkillConfig(postureConfig)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

// 30 frames a second: this many frames hold the posture for the time the skill asks.
const HOLD_FRAMES = Math.ceil((posture.rep.holdMs ?? 0) / (1000 / 30)) + 10

function judge(lean: number, elbow: number, frames = HOLD_FRAMES): string[][] {
  const recording = recordPoses(Array.from({ length: frames }, () => guitaristPose(lean, elbow)))
  return replayRecording(posture, recording).results.map((result) =>
    result.failed.map((outcome) => outcome.ruleId)
  )
}

describe('guitar posture', () => {
  it('only looks at the body, from the side', () => {
    expect(skillChannels(posture)).toEqual(['body'])
    expect(posture.camera).toMatchObject({ view: 'side' })
  })

  it('is shown as a posture that is held, with the time that makes it count', () => {
    expect(posture.display).toBe('hold')
    expect(posture.rep.holdMs).toBeGreaterThan(0)
  })

  it('has nothing to correct when the posture is held well', () => {
    expect(judge(0, 100)).toEqual([[]])
  })

  it('catches a bent back', () => {
    expect(judge(18, 100)).toEqual([['straight_back']])
  })

  it('catches an arm that is too closed or too open', () => {
    expect(judge(0, 65)).toEqual([['arm_closed']])
    expect(judge(0, 160)).toEqual([['arm_open']])
  })

  it('does not count a pose with the elbow folded or locked, such as a hug', () => {
    expect(judge(0, 40)).toEqual([])
    expect(judge(0, 178)).toEqual([])
  })

  it('judges again while the posture is kept', () => {
    expect(judge(0, 100, HOLD_FRAMES * 2).length).toBe(2)
  })

  it('does not judge a posture that is not held long enough', () => {
    expect(judge(0, 100, Math.floor(HOLD_FRAMES / 2))).toEqual([])
  })

  it('does not count someone who is bent over, which is not a posture at all', () => {
    expect(judge(40, 100)).toEqual([])
  })
})
