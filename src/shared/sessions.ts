// Shapes of the training data that travel between the renderer and the main process. Only
// numbers and rule names: never video, images or landmarks.

// How a repetition went overall.
//   good       every rule passed
//   needs-work only medium or low rules failed
//   bad        a high severity rule failed
//   unknown    no rule could be judged (the body was not measurable)
export type RepQuality = 'good' | 'needs-work' | 'bad' | 'unknown'

export interface RepToSave {
  index: number
  quality: RepQuality
  durationMs: number
  // The rules this repetition failed.
  failedRuleIds: string[]
}

export interface SessionToSave {
  skillId: string
  // Milliseconds since 1970.
  startedAt: number
  durationMs: number
  // 0..100, or null when no repetition could be judged.
  score: number | null
  reps: RepToSave[]
}

// One line of the history: the session with its totals.
export interface SessionRow {
  id: number
  skillId: string
  startedAt: number
  durationMs: number
  score: number | null
  repCount: number
  goodCount: number
  needsWorkCount: number
  badCount: number
}

export interface RepRecord extends RepToSave {
  id: number
}

export interface SessionDetail extends SessionRow {
  reps: RepRecord[]
}

export interface ErrorCount {
  ruleId: string
  count: number
}

export interface SessionQuery {
  skillId?: string
  // Newest first; no limit when left out.
  limit?: number
}
