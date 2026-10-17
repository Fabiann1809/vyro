import type { LearningPath } from './paths'
import type { SessionRow } from './sessions'

// How far a path has got, worked out from the sessions that were saved. Pure: the same path and
// the same sessions always give the same answer.

// done      the step is complete
// current   the step to do now (the first one that is not done)
// locked    an earlier step still has to be done
export type StepState = 'done' | 'current' | 'locked'

export interface StepProgress {
  stepId: number
  state: StepState
  // When it was completed, in milliseconds since 1970; null while it is not done.
  completedAt: number | null
  // For a skill step: the sessions that count, how many are needed, and how many were tried at all
  // (so that "not started" and "not there yet" can be told apart). Null for an auxiliary step.
  counted: number | null
  required: number | null
  attempts: number | null
}

export interface PathProgress {
  steps: StepProgress[]
  // The step to do now, or null when every step is done.
  currentStepId: number | null
  completed: boolean
}

// A step with a date is done, whatever else is true: that is how a step stays done once it has been
// worked out, and how an auxiliary step is marked by hand.
export function evaluatePath(path: LearningPath, sessions: readonly SessionRow[]): PathProgress {
  const ordered = [...path.steps].sort((a, b) => a.position - b.position)
  const steps: StepProgress[] = []
  // Sessions only count after the previous step was completed: otherwise one old session would
  // complete every later step that practises the same skill.
  let unlockedAt = path.createdAt
  let previousDone = true
  let currentStepId: number | null = null

  for (const step of ordered) {
    if (step.doneAt !== null) {
      steps.push({ ...empty(step), state: 'done', completedAt: step.doneAt })
      unlockedAt = Math.max(unlockedAt, step.doneAt)
      previousDone = true
      continue
    }

    if (!previousDone) {
      steps.push({ ...empty(step), state: 'locked', completedAt: null })
      continue
    }

    if (step.kind === 'auxiliary') {
      steps.push({ ...empty(step), state: 'current', completedAt: null })
      currentStepId ??= step.id
      previousDone = false
      continue
    }

    const tried = sessions
      .filter(
        (session) =>
          session.skillId === step.skillId &&
          session.startedAt > unlockedAt &&
          session.score !== null
      )
      .sort((a, b) => a.startedAt - b.startedAt)
    const counting = tried.filter((session) => (session.score ?? 0) >= step.criterionScore)
    const reached = counting[step.criterionSessions - 1]

    if (reached) {
      steps.push({
        stepId: step.id,
        state: 'done',
        completedAt: reached.startedAt,
        counted: step.criterionSessions,
        required: step.criterionSessions,
        attempts: tried.length
      })
      unlockedAt = reached.startedAt
    } else {
      steps.push({
        stepId: step.id,
        state: 'current',
        completedAt: null,
        counted: counting.length,
        required: step.criterionSessions,
        attempts: tried.length
      })
      currentStepId ??= step.id
      previousDone = false
    }
  }

  return { steps, currentStepId, completed: ordered.length > 0 && currentStepId === null }
}

function empty(step: LearningPath['steps'][number]): Omit<StepProgress, 'state' | 'completedAt'> {
  return {
    stepId: step.id,
    counted: step.kind === 'skill' ? 0 : null,
    required: step.kind === 'skill' ? step.criterionSessions : null,
    attempts: step.kind === 'skill' ? 0 : null
  }
}

// The path being followed, with how far it has got.
export interface CurrentPath {
  path: LearningPath
  progress: PathProgress
}
