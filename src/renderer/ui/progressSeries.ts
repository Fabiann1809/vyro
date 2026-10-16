import type { SessionRow } from '@shared/sessions'

export interface ProgressPoint {
  sessionId: number
  startedAt: number
  goodReps: number
  // null for a session in which nothing could be judged.
  score: number | null
}

// A line needs at least two points to say anything about the evolution.
export const MIN_SESSIONS_FOR_CHART = 2

// The sessions of one exercise as chart points, from the oldest to the newest (the history comes
// newest first).
export function buildProgressSeries(sessions: readonly SessionRow[]): ProgressPoint[] {
  return [...sessions]
    .sort((a, b) => a.startedAt - b.startedAt || a.id - b.id)
    .map((session) => ({
      sessionId: session.id,
      startedAt: session.startedAt,
      goodReps: session.goodCount,
      score: session.score
    }))
}
