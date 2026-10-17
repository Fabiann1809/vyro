import { describe, expect, it } from 'vitest'
import { pluck, sequence, silence } from '@renderer/core/audio/syntheticSound'
import { replayHandAndSound } from '@renderer/engine/bothReplay'
import { pressFrames, restFrames, type HandFrame } from '@renderer/engine/syntheticHand'
import { FRAME_MS } from '@renderer/engine/syntheticPose'
import { skillChannels } from '@shared/skill/skillChannels'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import noteConfig from './piano-note.json'

const piano: SkillConfig = (() => {
  const parsed = parseSkillConfig(noteConfig)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

type Bone = { proximalDeg: number; pipFlexDeg: number; dipFlexDeg: number }

// A curved finger lifted from the key, and resting on it.
const LIFTED: Bone = { proximalDeg: -20, pipFlexDeg: 20, dipFlexDeg: 10 }
const PRESSED: Bone = { proximalDeg: 15, pipFlexDeg: 36, dipFlexDeg: 20 }
// A flat finger, as in the skill of the hand alone.
const FLAT_LIFTED: Bone = { proximalDeg: -20, pipFlexDeg: 0, dipFlexDeg: 0 }
const FLAT_PRESSED: Bone = { proximalDeg: 40, pipFlexDeg: 3, dipFlexDeg: 2 }

const C4 = 261.63
const E4 = 329.63

interface Press {
  lifted?: Bone
  pressed?: Bone
  wristDeg?: number
  // The note that sounds when the key goes down, and how loud.
  hz?: number
  amplitude?: number
}

const LEAD_FRAMES = 15
const PRESS_FRAMES = 36
const TAIL_FRAMES = 10

// One press of a key: the finger rests lifted, goes down and comes up, and the note sounds while
// it is down.
function play({
  lifted = LIFTED,
  pressed = PRESSED,
  wristDeg = 0,
  hz = C4,
  amplitude = 0.5
}: Press = {}): {
  frames: HandFrame[]
  signal: Float32Array
} {
  const frames: HandFrame[] = []
  const next = (): number => (frames.at(-1)?.timestampMs ?? -FRAME_MS) + FRAME_MS
  frames.push(...restFrames(lifted, wristDeg, LEAD_FRAMES, next()))
  // pressFrames goes from the first pose to the second and back; here that is lifted → down → lifted.
  frames.push(...pressFrames(lifted, pressed, wristDeg, PRESS_FRAMES, next()))
  frames.push(...restFrames(lifted, wristDeg, TAIL_FRAMES, next()))

  const downAtSeconds = ((LEAD_FRAMES + PRESS_FRAMES * 0.3) * FRAME_MS) / 1000
  const totalSeconds = (frames.length * FRAME_MS) / 1000 + 0.2
  const ring = totalSeconds - downAtSeconds
  return {
    frames,
    signal: sequence(silence(downAtSeconds), pluck(hz, ring, { amplitude, decaySeconds: 1 }))
  }
}

function judge(press: Press): { reps: number; failed: string[] } {
  const { frames, signal } = play(press)
  const session = replayHandAndSound(piano, frames, signal)
  return {
    reps: session.repCount,
    failed: session.repResults[0]?.failed.map((outcome) => outcome.ruleId).sort() ?? []
  }
}

describe('C note on the piano', () => {
  it('looks at the hand and listens to the sound, and needs no body', () => {
    expect(skillChannels(piano)).toEqual(['hands', 'audio'])
  })

  it('counts a good press, with nothing to correct', () => {
    expect(judge({})).toEqual({ reps: 1, failed: [] })
  })

  it('catches a flat finger, which only the hand can tell', () => {
    expect(judge({ lifted: FLAT_LIFTED, pressed: FLAT_PRESSED })).toEqual({
      reps: 1,
      failed: ['flat_finger']
    })
  })

  it('catches a wrist that is too low, which only the hand can tell', () => {
    expect(judge({ wristDeg: 30 })).toEqual({ reps: 1, failed: ['wrist_level'] })
  })

  it('catches another note, which only the sound can tell', () => {
    expect(judge({ hz: E4 })).toEqual({ reps: 1, failed: ['wrong_note'] })
  })

  it('catches a press that is too soft, which only the sound can tell', () => {
    expect(judge({ amplitude: 0.012 })).toEqual({ reps: 1, failed: ['too_soft'] })
  })

  it('fails a rule of the sound and a rule of the hand in the same press', () => {
    expect(judge({ lifted: FLAT_LIFTED, pressed: FLAT_PRESSED, hz: E4 })).toEqual({
      reps: 1,
      failed: ['flat_finger', 'wrong_note']
    })
  })

  it('fails all of them at once when everything is wrong', () => {
    expect(
      judge({ lifted: FLAT_LIFTED, pressed: FLAT_PRESSED, wristDeg: 30, hz: E4, amplitude: 0.012 })
    ).toEqual({
      reps: 1,
      failed: ['flat_finger', 'too_soft', 'wrist_level', 'wrong_note']
    })
  })

  it('does not judge while the hand is out of view, even with sound', () => {
    const { signal } = play()
    const session = replayHandAndSound(
      piano,
      play().frames.map((frame) => ({ ...frame, hand: [] })),
      signal
    )

    expect(session.repCount).toBe(0)
  })

  it('does not judge while the microphone is silent and nothing is heard', () => {
    const { frames } = play()
    const session = replayHandAndSound(piano, frames, silence(3))

    expect(
      session.repResults.flatMap((result) => result.failed.map((o) => o.ruleId))
    ).not.toContain('flat_finger')
  })
})
