import { isHandJoint, type AnyJointName } from './joints'
import type { SkillConfig, SkillMetric } from './skillSchema'

export type SkillChannel = 'body' | 'hands'

function jointsOf(metric: SkillMetric): AnyJointName[] {
  switch (metric.type) {
    case 'angle':
      return [...metric.points]
    case 'tilt':
      return [metric.from, metric.to]
    case 'offset':
    case 'gap':
      return [metric.from, metric.to, ...metric.scale]
  }
}

// What the skill needs to see: the body, the hands, or both. The app loads a model only for a
// channel that is used.
export function skillChannels(skill: Pick<SkillConfig, 'metrics'>): SkillChannel[] {
  const joints = Object.values(skill.metrics).flatMap(jointsOf)
  const channels: SkillChannel[] = []
  if (joints.some((name) => !isHandJoint(name))) channels.push('body')
  if (joints.some(isHandJoint)) channels.push('hands')
  return channels
}
