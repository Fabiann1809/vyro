import { localize, t, type MessageKey } from '@renderer/i18n'
import type { AnyJointName } from '@shared/skill/joints'
import type { Severity, SkillConfig, SkillMetric } from '@shared/skill/skillSchema'

const JOINT_TEXT: Record<AnyJointName, MessageKey> = {
  shoulder: 'joint.shoulder',
  elbow: 'joint.elbow',
  wrist: 'joint.wrist',
  hip: 'joint.hip',
  knee: 'joint.knee',
  ankle: 'joint.ankle',
  heel: 'joint.heel',
  footIndex: 'joint.footIndex',
  handWrist: 'joint.handWrist',
  thumbCmc: 'joint.thumbCmc',
  thumbMcp: 'joint.thumbMcp',
  thumbIp: 'joint.thumbIp',
  thumbTip: 'joint.thumbTip',
  indexMcp: 'joint.indexMcp',
  indexPip: 'joint.indexPip',
  indexDip: 'joint.indexDip',
  indexTip: 'joint.indexTip',
  middleMcp: 'joint.middleMcp',
  middlePip: 'joint.middlePip',
  middleDip: 'joint.middleDip',
  middleTip: 'joint.middleTip',
  ringMcp: 'joint.ringMcp',
  ringPip: 'joint.ringPip',
  ringDip: 'joint.ringDip',
  ringTip: 'joint.ringTip',
  pinkyMcp: 'joint.pinkyMcp',
  pinkyPip: 'joint.pinkyPip',
  pinkyDip: 'joint.pinkyDip',
  pinkyTip: 'joint.pinkyTip'
}

const SEVERITY_TEXT: Record<Severity, MessageKey> = {
  high: 'skill.severity.high',
  medium: 'skill.severity.medium',
  low: 'skill.severity.low'
}

const joint = (name: AnyJointName): string => t(JOINT_TEXT[name])

function metricText(name: string, metric: SkillMetric): string {
  switch (metric.type) {
    case 'angle':
      return t('skill.metric.angle', {
        name,
        a: joint(metric.points[0]),
        b: joint(metric.points[1]),
        c: joint(metric.points[2])
      })
    case 'tilt':
      return t('skill.metric.tilt', { name, from: joint(metric.from), to: joint(metric.to) })
    case 'offset':
      return t('skill.metric.offset', {
        name,
        from: joint(metric.from),
        to: joint(metric.to),
        axis: t(metric.axis === 'x' ? 'skill.axis.x' : 'skill.axis.y')
      })
    case 'gap':
      return t('skill.metric.gap', {
        name,
        from: joint(metric.from),
        to: joint(metric.to),
        scaleFrom: joint(metric.scale[0]),
        scaleTo: joint(metric.scale[1])
      })
  }
}

export interface SkillPreview {
  name: string
  camera: string
  metrics: string[]
  phases: string[]
  repetition: string
  rules: Array<{ severity: string; message: string }>
}

// What a skill will do, in words a person can check before trying it.
export function describeSkill(skill: SkillConfig): SkillPreview {
  return {
    name: localize(skill.name),
    camera: t(skill.camera.view === 'side' ? 'skill.camera.side' : 'skill.camera.front', {
      body: t(skill.camera.fullBody ? 'skill.camera.fullBody' : 'skill.camera.upperBody')
    }),
    metrics: Object.entries(skill.metrics).map(([name, metric]) => metricText(name, metric)),
    phases: skill.phases.map((phase) => {
      const conditions = Object.entries(phase.when).flatMap(([name, { gt, lt }]) => [
        ...(gt !== undefined ? [t('skill.when.gt', { name, value: gt })] : []),
        ...(lt !== undefined ? [t('skill.when.lt', { name, value: lt })] : [])
      ])
      return t('skill.phase', { id: phase.id, conditions: conditions.join(', ') })
    }),
    repetition: t('skill.repetition', {
      sequence: skill.rep.sequence.join(' → '),
      seconds: (skill.rep.minDurationMs / 1000).toFixed(1)
    }),
    rules: skill.rules.map((rule) => ({
      severity: t(SEVERITY_TEXT[rule.severity]),
      message: localize(rule.message)
    }))
  }
}
