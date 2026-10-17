import type { PathStep } from '@shared/paths'
import type { CurrentPath } from '@shared/pathProgress'
import type { SessionRow } from '@shared/sessions'

// What the summary says about a session that goes beyond its own numbers: how it compares with the
// earlier ones, and what it did for the path being followed. Pure functions.

export interface Comparison {
  // The score of the session before this one with a score; null if there is none.
  previous: number | null
  // How many points better (positive) or worse; null without a previous one.
  delta: number | null
  // Whether it beats every earlier score of the skill.
  best: boolean
}

// The sessions of one skill, among which is the one just ended (it began at `startedAt`): this one is
// compared with those that began before it.
export function compareWithBefore(
  sessions: readonly SessionRow[],
  startedAt: number,
  score: number
): Comparison {
  const before = sessions
    .filter((session) => session.startedAt < startedAt && session.score !== null)
    .sort((a, b) => b.startedAt - a.startedAt)
  const scores = before.map((session) => session.score as number)
  const previous = scores[0] ?? null

  return {
    previous,
    delta: previous === null ? null : score - previous,
    best: scores.length > 0 && score > Math.max(...scores)
  }
}

export type StepOutcome =
  // The session finished a step of the path.
  | { kind: 'completed'; position: number; title: string; next: PathStep | null }
  // The session counts towards the step that is next: this many out of the ones needed.
  | { kind: 'counted'; position: number; counted: number; required: number }

// What the session did for the path, if it practised a skill that a step of it asks for.
export function stepOutcome(
  current: CurrentPath | null,
  skillId: string,
  startedAt: number,
  score: number
): StepOutcome | null {
  if (!current) return null

  const steps = [...current.path.steps].sort((a, b) => a.position - b.position)
  for (const step of steps) {
    if (step.kind !== 'skill' || step.skillId !== skillId) continue
    const progress = current.progress.steps.find((item) => item.stepId === step.id)
    if (!progress) continue

    if (
      progress.state === 'done' &&
      progress.completedAt !== null &&
      progress.completedAt >= startedAt
    ) {
      const next =
        steps.find((candidate) => candidate.id === current.progress.currentStepId) ?? null
      return { kind: 'completed', position: step.position, title: step.title, next }
    }
    if (
      progress.state === 'current' &&
      progress.counted !== null &&
      progress.required !== null &&
      score >= step.criterionScore
    ) {
      return {
        kind: 'counted',
        position: step.position,
        counted: progress.counted,
        required: progress.required
      }
    }
  }
  return null
}
