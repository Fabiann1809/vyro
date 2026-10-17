// Plays the body, the hand, the object and the sound through the engine together, frame by frame
// of the camera, the way the training screen does. Used by the tests only: nothing in the app
// imports this file.

import { measureSound } from '@renderer/core/audio/capture'
import { SAMPLE_RATE } from '@renderer/core/audio/syntheticSound'
import type { Landmark } from '@renderer/core/landmarks'
import type { ObjectBox } from '@renderer/core/objectFrame'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { SkillSession } from './skillSession'
import { FRAME_SIZE } from './syntheticPose'

const WINDOW = 2048

export interface SensedFrame {
  timestampMs: number
  landmarks?: readonly Landmark[] | null
  hand?: readonly Landmark[] | null
  object?: ObjectBox | null
}

export function replayAll(
  skill: SkillConfig,
  frames: readonly SensedFrame[],
  signal: Float32Array,
  frameSize = FRAME_SIZE
): SkillSession {
  const session = new SkillSession(skill, frameSize)
  const first = frames[0]?.timestampMs ?? 0
  for (const frame of frames) {
    // The sound is read over the 43 ms that end at the moment of the frame.
    const end = Math.round(((frame.timestampMs - first) / 1000) * SAMPLE_RATE) + WINDOW
    const window = signal.subarray(Math.max(0, end - WINDOW), end)
    session.processFrame({
      timestampMs: frame.timestampMs,
      landmarks: frame.landmarks ?? null,
      hand: frame.hand ?? null,
      object: frame.object ?? null,
      audio: window.length === WINDOW ? measureSound(window, SAMPLE_RATE) : null
    })
  }
  return session
}
