import type { MetricValues } from './metrics'
import type { SkillConfig } from '@shared/skill/skillSchema'

type Phase = SkillConfig['phases'][number]
type Conditions = Phase['when']
type MetricType = SkillConfig['metrics'][string]['type']

export interface PhaseUpdate {
  // The phase the body is in now, or null before any phase has been reached.
  phase: string | null
  // The phase it was in before this frame.
  previous: string | null
  changed: boolean
}

// How far past a threshold a measure must go before it counts as having left a phase.
// Angles are in degrees; an offset is a fraction of the reference segment.
export const DEFAULT_HYSTERESIS: Record<MetricType, number> = {
  angle: 5,
  tilt: 5,
  offset: 0.03,
  gap: 0.03,
  pitch: 3,
  level: 3,
  interval: 5,
  tempo: 2
}

type Verdict = 'yes' | 'no' | 'unknown'

// Tells the phase of the body from the metrics of each frame.
//
// A phase is entered when all its conditions hold. Once inside, the body stays in it until the
// conditions fail by more than the hysteresis margin, so noise around a threshold does not make
// the phase flicker. Between two phases (the "dead band") the last phase is kept.
export class PhaseDetector {
  private current: Phase | null = null

  constructor(
    private readonly skill: Pick<SkillConfig, 'phases' | 'metrics'>,
    private readonly hysteresis: Record<MetricType, number> = DEFAULT_HYSTERESIS
  ) {}

  update(values: MetricValues): PhaseUpdate {
    const previous = this.current?.id ?? null

    if (this.current && this.evaluate(this.current.when, values, true) !== 'no') {
      return { phase: previous, previous, changed: false }
    }

    const entered = this.skill.phases.find(
      (phase) => phase !== this.current && this.evaluate(phase.when, values, false) === 'yes'
    )
    if (!entered) return { phase: previous, previous, changed: false }

    this.current = entered
    return { phase: entered.id, previous, changed: true }
  }

  // True when the metrics satisfy the conditions of the phase right now, without hysteresis.
  isIn(phaseId: string, values: MetricValues): boolean {
    const phase = this.skill.phases.find((candidate) => candidate.id === phaseId)
    return phase !== undefined && this.evaluate(phase.when, values, false) === 'yes'
  }

  reset(): void {
    this.current = null
  }

  // `relaxed` widens every condition by its margin (used to decide whether to stay in a phase).
  private evaluate(when: Conditions, values: MetricValues, relaxed: boolean): Verdict {
    let verdict: Verdict = 'yes'

    for (const [name, limits] of Object.entries(when)) {
      const value = values[name]
      const type = this.skill.metrics[name]?.type
      if (value === null || value === undefined || !type) {
        verdict = 'unknown'
        continue
      }

      const margin = relaxed ? this.hysteresis[type] : 0
      if (limits.gt !== undefined && !(value > limits.gt - margin)) return 'no'
      if (limits.lt !== undefined && !(value < limits.lt + margin)) return 'no'
    }

    return verdict
  }
}
