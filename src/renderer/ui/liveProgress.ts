import type { MessageKey } from '@renderer/i18n'
import type { SessionNumbers } from '@renderer/engine/sessionSummary'
import type { ProgressMeasure, ProgressUnit } from '@shared/skill/progress'
import type { SkillConfig } from '@shared/skill/skillSchema'

// What an attempt is called on the screen, by the unit the skill declares (repetitions by default).
const UNIT_LABEL: Record<ProgressUnit, MessageKey> = {
  reps: 'training.unit.reps',
  holds: 'training.unit.holds',
  attempts: 'training.unit.attempts',
  notes: 'training.unit.notes'
}

export const unitLabel = (skill: SkillConfig): MessageKey =>
  UNIT_LABEL[skill.progress?.unit ?? 'reps']

export interface LiveLine {
  key: MessageKey
  params: Record<string, number>
}

// The short lines that say how the session goes so far, for the measures the skill declares. A
// skill that declares none shows only the counter, as the first skills always did.
export function liveLines(
  numbers: SessionNumbers,
  measures: readonly ProgressMeasure[]
): LiveLine[] {
  const lines: LiveLine[] = []

  if (measures.includes('cleanRate') && numbers.judged > 0) {
    lines.push({
      key: 'training.live.clean',
      params: { good: numbers.good, judged: numbers.judged }
    })
  }
  if (measures.includes('timeWell') && numbers.timeWell !== null) {
    lines.push({ key: 'training.live.timeWell', params: { percent: numbers.timeWell } })
  }
  if (measures.includes('bestStreak') && numbers.bestStreak > 0) {
    lines.push({
      key: 'training.live.streak',
      params: { seconds: Math.round(numbers.bestStreakMs / 1000) }
    })
  }
  return lines
}
