// Plays a piece of sound through the whole engine, reading it the way the capture does, and says what
// came out. Used by the tests only: nothing in the app imports this file.

import { measureSound } from '@renderer/core/audio/capture'
import { SAMPLE_RATE } from '@renderer/core/audio/syntheticSound'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { SkillSession } from './skillSession'

const WINDOW = 2048
const HOP_MS = 33

export function replaySound(skill: SkillConfig, signal: Float32Array): SkillSession {
  const session = new SkillSession(skill, { width: 1, height: 1 })
  const hop = Math.round((HOP_MS / 1000) * SAMPLE_RATE)
  for (let end = WINDOW; end <= signal.length; end += hop) {
    session.processFrame({
      timestampMs: (end / SAMPLE_RATE) * 1000,
      landmarks: null,
      audio: measureSound(signal.subarray(end - WINDOW, end), SAMPLE_RATE)
    })
  }
  return session
}
