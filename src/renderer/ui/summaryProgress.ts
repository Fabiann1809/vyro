import type { MessageKey } from '@renderer/i18n'
import {
  compareWithPrevious,
  measureOf,
  type Change,
  type Trend
} from '../engine/sessionComparison'
import type { SessionNumbers } from '../engine/sessionSummary'
import type { ProgressMeasure, ProgressUnit } from '@shared/skill/progress'

// What the summary says about a session beyond the score, in the terms the skill chose.

const LABEL: Record<Exclude<ProgressMeasure, 'vsPrevious'>, MessageKey> = {
  cleanRate: 'summary.measure.cleanRate',
  timeWell: 'summary.measure.timeWell',
  bestStreak: 'summary.measure.bestStreak'
}

// How many attempts there were, in the words of the unit (the plural is picked by the count).
export const UNIT_TOTAL: Record<ProgressUnit, MessageKey> = {
  reps: 'summary.total',
  holds: 'summary.total.holds',
  attempts: 'summary.total.attempts',
  notes: 'summary.total.notes'
}

// The title of the chart with the quality of each attempt.
export const UNIT_SEQUENCE: Record<ProgressUnit, MessageKey> = {
  reps: 'summary.sequence',
  holds: 'summary.sequence.holds',
  attempts: 'summary.sequence.attempts',
  notes: 'summary.sequence.notes'
}

export interface MeasureRow {
  label: MessageKey
  value: string
  // The same measure in the previous session, when the skill compares and there was one.
  before: string | null
  trend: Trend | null
}

// A percentage as the person reads it, and a streak in seconds.
function show(what: Change['what'], value: number): string {
  return what === 'bestStreak' ? `${Math.round(value / 1000)} s` : `${value} %`
}

// One row per measure the skill declares that could be worked out for this session. When the skill
// asks for "vsPrevious" the row also carries the value of the session before and how it changed.
export function measureRows(
  today: SessionNumbers,
  previous: SessionNumbers | null,
  measures: readonly ProgressMeasure[]
): MeasureRow[] {
  const changes = measures.includes('vsPrevious')
    ? compareWithPrevious(today, previous, measures)
    : []

  return measures.flatMap((measure) => {
    if (measure === 'vsPrevious') return []
    const value = measureOf(measure, today)
    if (value === null) return []

    const change = changes.find((item) => item.what === measure)
    return [
      {
        label: LABEL[measure],
        value: show(measure, value),
        before: change ? show(measure, change.before) : null,
        trend: change?.trend ?? null
      }
    ]
  })
}

// How many attempts were left out of the numbers because nothing could be judged in them.
export const unjudgedCount = (qualities: readonly string[]): number =>
  qualities.filter((quality) => quality === 'unknown').length
