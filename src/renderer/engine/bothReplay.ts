// Plays the hand and the sound through the engine together, frame by frame of the camera, the way
// the training screen does. Used by the tests only: nothing in the app imports this file.

import { measureSound } from '@renderer/core/audio/capture'
import { SAMPLE_RATE } from '@renderer/core/audio/syntheticSound'
import type { SkillConfig } from '@shared/skill/skillSchema'
import type { HandFrame } from './syntheticHand'
import { SkillSession } from './skillSession'

const WINDOW = 2048

export function replayHandAndSound(
  skill: SkillConfig,
  frames: readonly HandFrame[],
  signal: Float32Array,
  frameSize = { width: 1280, height: 720 }
): SkillSession {
  const session = new SkillSession(skill, frameSize)
  const first = frames[0]?.timestampMs ?? 0
  for (const frame of frames) {
    // The sound is read over the 43 ms that end at the moment of the frame.
    const end = Math.round(((frame.timestampMs - first) / 1000) * SAMPLE_RATE) + WINDOW
    const window = signal.subarray(Math.max(0, end - WINDOW), end)
    session.processFrame({
      timestampMs: frame.timestampMs,
      landmarks: null,
      hand: frame.hand,
      audio: window.length === WINDOW ? measureSound(window, SAMPLE_RATE) : null
    })
  }
  return session
}
