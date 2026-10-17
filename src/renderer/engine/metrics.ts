import { angleAt, distance, tiltFromVertical, toPixels, type Point } from '@renderer/core/geometry'
import { centsBetween, frequencyOfMidi, nearestNote, noteToMidi } from '@renderer/core/audio/pitch'
import { handJoint } from '@renderer/core/handJoints'
import type { Landmark } from '@renderer/core/landmarks'
import { joint, type Side } from '@renderer/core/side'
import { isHandJoint, type AnyJointName } from '@shared/skill/joints'
import { isAudioMetric } from '@shared/skill/skillChannels'
import type { SkillConfig } from '@shared/skill/skillSchema'
import type { AudioState } from './audioTracker'

export interface FrameSize {
  width: number
  height: number
}

// One value per metric of the skill. null means "could not be measured in this frame":
// a needed joint is hidden, or two points coincide so the measure is undefined.
export type MetricValues = Record<string, number | null>

type MetricDefinition = SkillConfig['metrics'][string]

// Body joints are looked up on the visible side and hand joints on the hand being followed. Both
// are converted to pixels, because angles measured on normalized coordinates are distorted by the
// shape of the frame. A point that is not there (no body, no hand, hidden) is null.
function pointOf(
  body: { landmarks: readonly Landmark[]; side: Side } | null,
  hand: readonly Landmark[] | null,
  name: AnyJointName,
  frame: FrameSize
): Point | null {
  const landmark = isHandJoint(name)
    ? hand && handJoint(hand, name)
    : body && joint(body.landmarks, name, body.side)
  return landmark ? toPixels(landmark, frame.width, frame.height) : null
}

// What a metric of sound says about the sound heard; null when there is nothing to say (no sound
// yet, no pitch in it, fewer than two notes).
function measureAudio(
  metric: MetricDefinition,
  audio: AudioState | null,
  a4: number
): number | null {
  if (!audio) return null
  switch (metric.type) {
    case 'level':
      return audio.levelDb
    case 'pitch': {
      if (audio.pitchHz === 0) return null
      if (metric.target === 'nearest') return nearestNote(audio.pitchHz, a4).cents
      const midi = noteToMidi(metric.target)
      return midi === null ? null : centsBetween(audio.pitchHz, frequencyOfMidi(midi, a4))
    }
    case 'interval':
      return audio.noteHz > 0 && audio.previousNoteHz > 0
        ? centsBetween(audio.noteHz, audio.previousNoteHz) - metric.semitones * 100
        : null
    case 'tempo':
      return audio.bpm
    default:
      return null
  }
}

function measure(
  metric: MetricDefinition,
  at: (name: AnyJointName) => Point | null
): number | null {
  switch (metric.type) {
    case 'angle': {
      const [first, vertex, last] = metric.points.map(at)
      return first && vertex && last ? angleAt(first, vertex, last) : null
    }
    case 'tilt': {
      const from = at(metric.from)
      const to = at(metric.to)
      return from && to ? tiltFromVertical(from, to) : null
    }
    case 'offset': {
      const from = at(metric.from)
      const to = at(metric.to)
      const [scaleStart, scaleEnd] = metric.scale.map(at)
      if (!from || !to || !scaleStart || !scaleEnd) return null

      const scale = distance(scaleStart, scaleEnd)
      return scale === 0 ? null : (to[metric.axis] - from[metric.axis]) / scale
    }
    case 'gap': {
      const from = at(metric.from)
      const to = at(metric.to)
      const [scaleStart, scaleEnd] = metric.scale.map(at)
      if (!from || !to || !scaleStart || !scaleEnd) return null

      const scale = distance(scaleStart, scaleEnd)
      return scale === 0 ? null : distance(from, to) / scale
    }
    default:
      return null
  }
}

// `landmarks` and `side` are null when the body is not in view, and `hand` when no hand is: a skill
// that only looks at hands does not need the body, and the other way round.
export function computeMetrics(
  metrics: SkillConfig['metrics'],
  landmarks: readonly Landmark[] | null,
  side: Side | null,
  frame: FrameSize,
  hand: readonly Landmark[] | null = null,
  // The sound, and the pitch of the A above middle C, for the skills that listen.
  audio: AudioState | null = null,
  a4 = 440
): MetricValues {
  const body = landmarks && side ? { landmarks, side } : null
  const at = (name: AnyJointName): Point | null => pointOf(body, hand, name, frame)

  return Object.fromEntries(
    Object.entries(metrics).map(([name, metric]) => [
      name,
      isAudioMetric(metric) ? measureAudio(metric, audio, a4) : measure(metric, at)
    ])
  )
}
