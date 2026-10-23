import type { ProgressMeasure } from '@shared/skill/progress'
import type { SessionNumbers } from './sessionSummary'

export type Trend = 'better' | 'same' | 'worse'

export interface Change {
  // What is compared: the score always, and the measures the skill shows.
  what: 'score' | 'cleanRate' | 'timeWell' | 'bestStreak'
  today: number
  before: number
  trend: Trend
}

// Differences smaller than this are noise, not progress: points for the percentages, milliseconds
// for the streak (a held posture is judged every few seconds, so one second is rounding).
const MARGIN: Record<Change['what'], number> = {
  score: 2,
  cleanRate: 2,
  timeWell: 2,
  bestStreak: 1000
}

const VALUE: Record<Change['what'], (numbers: SessionNumbers) => number | null> = {
  score: (numbers) => numbers.score,
  cleanRate: (numbers) => numbers.cleanRate,
  timeWell: (numbers) => numbers.timeWell,
  // Compared by how long it lasted, which is what a person feels, not by how many attempts.
  bestStreak: (numbers) => (numbers.bestStreak > 0 ? numbers.bestStreakMs : null)
}

// The value of one measure for a session, in the unit it is compared in; null when it could not be
// worked out.
export const measureOf = (what: Change['what'], numbers: SessionNumbers): number | null =>
  VALUE[what](numbers)

function trendOf(today: number, before: number, margin: number): Trend {
  if (today - before > margin) return 'better'
  return before - today > margin ? 'worse' : 'same'
}

// Today's session against the last one of the same skill, for the score and the measures the skill
// declares. A measure that could not be worked out in either session is left out, and with no
// previous session (null) there is nothing to compare.
export function compareWithPrevious(
  today: SessionNumbers,
  previous: SessionNumbers | null,
  measures: readonly ProgressMeasure[]
): Change[] {
  if (!previous) return []

  const wanted = new Set<Change['what']>(['score'])
  for (const measure of measures) {
    if (measure !== 'vsPrevious') wanted.add(measure)
  }

  return [...wanted].flatMap((what) => {
    const now = VALUE[what](today)
    const before = VALUE[what](previous)
    if (now === null || before === null) return []
    return [{ what, today: now, before, trend: trendOf(now, before, MARGIN[what]) }]
  })
}
