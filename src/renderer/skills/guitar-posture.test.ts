import { describe, expect, it } from 'vitest'
import { pluck, sequence, silence } from '@renderer/core/audio/syntheticSound'
import type { ObjectBox } from '@renderer/core/objectFrame'
import { replayAll, type SensedFrame } from '@renderer/engine/fullReplay'
import { restFrames } from '@renderer/engine/syntheticHand'
import { FRAME_MS, FRAME_SIZE, seatedPose } from '@renderer/engine/syntheticPose'
import { skillChannels } from '@shared/skill/skillChannels'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import postureConfig from './guitar-posture.json'

const guitar: SkillConfig = (() => {
  const parsed = parseSkillConfig(postureConfig)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

const E4 = 329.63
const FRAMES = 60
// A relaxed hand, with the curved fingers of someone fretting a chord.
const FINGERS = { proximalDeg: -20, pipFlexDeg: 20, dipFlexDeg: 10 }

// A box in pixels of the picture.
const box = (x: number, y: number, width: number, height: number): ObjectBox => ({
  x: x / FRAME_SIZE.width,
  y: y / FRAME_SIZE.height,
  width: width / FRAME_SIZE.width,
  height: height / FRAME_SIZE.height,
  score: 0.9
})

// Lying across the chest: centred 140 px under the shoulder, half the torso (280 px).
const ACROSS_THE_CHEST = box(430, 210, 420, 200)
const STANDING_UP = box(580, 110, 120, 400)
const AT_THE_KNEES = box(430, 462, 420, 200)
// Standing up and also too low: it fails the shape and the height at once.
const STANDING_AT_THE_KNEES = box(580, 362, 120, 400)

interface Playing {
  leanDeg?: number
  guitarBox?: ObjectBox | null
  wristDeg?: number
  hz?: number
}

// One note played while sitting: the body, the hand and the guitar hold still, and the note
// sounds for a moment in the middle.
function play({ leanDeg = 0, guitarBox = ACROSS_THE_CHEST, wristDeg = 0, hz = E4 }: Playing = {}): {
  frames: SensedFrame[]
  signal: Float32Array
} {
  const body = seatedPose(leanDeg)
  const hand = restFrames(FINGERS, wristDeg, FRAMES, 0)
  const frames: SensedFrame[] = hand.map((frame) => ({
    timestampMs: frame.timestampMs,
    landmarks: body,
    hand: frame.hand,
    object: guitarBox
  }))
  const seconds = (FRAMES * FRAME_MS) / 1000 + 0.2
  const note = pluck(hz, 0.7, { amplitude: 0.5, decaySeconds: 0.12 })
  return { frames, signal: sequence(silence(0.4), note, silence(seconds - 1.1)) }
}

function judge(playing: Playing): { reps: number; failed: string[] } {
  const { frames, signal } = play(playing)
  const session = replayAll(guitar, frames, signal)
  return {
    reps: session.repCount,
    failed: session.repResults[0]?.failed.map((outcome) => outcome.ruleId).sort() ?? []
  }
}

describe('guitar posture', () => {
  it('uses the four channels: the body, the hand, the guitar and the sound', () => {
    expect(skillChannels(guitar)).toEqual(['body', 'hands', 'object', 'audio'])
  })

  it('counts a note played with a good posture, with nothing to correct', () => {
    expect(judge({})).toEqual({ reps: 1, failed: [] })
  })

  it('catches a bent back, which only the body can tell', () => {
    expect(judge({ leanDeg: 25 })).toEqual({ reps: 1, failed: ['straight_back'] })
  })

  it('catches a guitar that stands up, which only the object can tell', () => {
    expect(judge({ guitarBox: STANDING_UP })).toEqual({ reps: 1, failed: ['guitar_across'] })
  })

  it('catches a guitar held too low, which needs the object and the body together', () => {
    expect(judge({ guitarBox: AT_THE_KNEES })).toEqual({ reps: 1, failed: ['guitar_height'] })
  })

  it('catches a bent wrist, which only the hand can tell', () => {
    expect(judge({ wristDeg: 30 })).toEqual({ reps: 1, failed: ['fretting_wrist'] })
  })

  it('catches a note that is out of tune, which only the sound can tell', () => {
    // 40 cents above E4, still closest to E4.
    expect(judge({ hz: E4 * 2 ** (40 / 1200) })).toEqual({ reps: 1, failed: ['out_of_tune'] })
  })

  it('fails a rule of each channel in the same note', () => {
    expect(
      judge({
        leanDeg: 25,
        guitarBox: STANDING_AT_THE_KNEES,
        wristDeg: 30,
        hz: E4 * 2 ** (40 / 1200)
      })
    ).toEqual({
      reps: 1,
      failed: ['fretting_wrist', 'guitar_across', 'guitar_height', 'out_of_tune', 'straight_back']
    })
  })

  it('does not judge while the guitar is out of view', () => {
    expect(judge({ guitarBox: null }).reps).toBe(0)
  })

  it('does not judge while the person is out of view', () => {
    const { frames, signal } = play()
    const session = replayAll(
      guitar,
      frames.map((frame) => ({ ...frame, landmarks: null })),
      signal
    )

    expect(session.repCount).toBe(0)
  })
})
