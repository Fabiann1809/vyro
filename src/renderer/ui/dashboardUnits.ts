import type { MessageKey } from '@renderer/i18n'
import { measureOf } from '@renderer/engine/sessionComparison'
import { sessionNumbers } from '@renderer/engine/sessionSummary'
import type { ProgressMeasure, ProgressUnit } from '@shared/skill/progress'
import type { SessionDetail } from '@shared/sessions'

// What the dashboard says about a skill in the unit it chose, and how its measures went session by
// session. Pure functions: the cards only draw what they return.

export interface QualityWords {
  label: MessageKey
  rep: MessageKey
  summary: MessageKey
  empty: MessageKey
  tooFew: MessageKey
}

// The texts of the quality card for each unit; a skill without a unit counts repetitions.
export const QUALITY_WORDS: Record<ProgressUnit, QualityWords> = {
  reps: {
    label: 'dashboard.quality.label',
    rep: 'dashboard.quality.rep',
    summary: 'dashboard.quality.summary',
    empty: 'dashboard.quality.empty',
    tooFew: 'dashboard.quality.tooFew'
  },
  holds: {
    label: 'dashboard.quality.label.holds',
    rep: 'dashboard.quality.rep.holds',
    summary: 'dashboard.quality.summary.holds',
    empty: 'dashboard.quality.empty.holds',
    tooFew: 'dashboard.quality.tooFew.holds'
  },
  attempts: {
    label: 'dashboard.quality.label.attempts',
    rep: 'dashboard.quality.rep.attempts',
    summary: 'dashboard.quality.summary.attempts',
    empty: 'dashboard.quality.empty.attempts',
    tooFew: 'dashboard.quality.tooFew.attempts'
  },
  notes: {
    label: 'dashboard.quality.label.notes',
    rep: 'dashboard.quality.rep.notes',
    summary: 'dashboard.quality.summary.notes',
    empty: 'dashboard.quality.empty.notes',
    tooFew: 'dashboard.quality.tooFew.notes'
  }
}

export type SeriesMeasure = Exclude<ProgressMeasure, 'vsPrevious'>

export interface MeasureSeries {
  measure: SeriesMeasure
  // One value per session from the oldest: percent for the rates, seconds for the streak.
  values: number[]
}

export const MEASURE_SESSIONS = 9

const toShown = (measure: SeriesMeasure, value: number): number =>
  measure === 'bestStreak' ? Math.round(value / 1000) : value

// The declared measures of a skill over its sessions. A session where a measure could not be worked
// out leaves no point in that series, and a measure with no points at all is left out.
export function measureSeries(
  details: readonly SessionDetail[],
  measures: readonly ProgressMeasure[]
): MeasureSeries[] {
  const ordered = [...details].sort((a, b) => a.startedAt - b.startedAt || a.id - b.id)
  const numbers = ordered.map((detail) => sessionNumbers(detail.reps))

  return measures.flatMap((measure) => {
    if (measure === 'vsPrevious') return []
    const values = numbers.flatMap((session) => {
      const value = measureOf(measure, session)
      return value === null ? [] : [toShown(measure, value)]
    })
    return values.length === 0 ? [] : [{ measure, values: values.slice(-MEASURE_SESSIONS) }]
  })
}
