import { isHandJoint, type AnyJointName } from './joints'
import type { SkillConfig, SkillMetric } from './skillSchema'

export type SkillChannel = 'body' | 'hands' | 'audio' | 'object'

// The channel of an audio metric; a metric of joints belongs to the body or the hands, by its joints.
const AUDIO_METRICS: ReadonlySet<SkillMetric['type']> = new Set([
  'pitch',
  'level',
  'interval',
  'tempo'
])

export const isAudioMetric = (metric: SkillMetric): boolean => AUDIO_METRICS.has(metric.type)

const OBJECT_METRICS: ReadonlySet<SkillMetric['type']> = new Set(['objectOffset', 'objectAspect'])

export const isObjectMetric = (metric: SkillMetric): boolean => OBJECT_METRICS.has(metric.type)

function jointsOf(metric: SkillMetric): AnyJointName[] {
  switch (metric.type) {
    case 'angle':
      return [...metric.points]
    case 'tilt':
      return [metric.from, metric.to]
    case 'offset':
    case 'gap':
      return [metric.from, metric.to, ...metric.scale]
    case 'objectOffset':
      return [metric.to, ...metric.scale]
    default:
      return []
  }
}

// What the skill needs to see or hear: the body, the hands, an object, the sound, or several. The app loads a
// model, or opens the microphone, only for a channel that is used.
export function skillChannels(skill: Pick<SkillConfig, 'metrics'>): SkillChannel[] {
  const metrics = Object.values(skill.metrics)
  const joints = metrics.flatMap(jointsOf)
  const channels: SkillChannel[] = []
  if (joints.some((name) => !isHandJoint(name))) channels.push('body')
  if (joints.some(isHandJoint)) channels.push('hands')
  if (metrics.some(isObjectMetric)) channels.push('object')
  if (metrics.some(isAudioMetric)) channels.push('audio')
  return channels
}
