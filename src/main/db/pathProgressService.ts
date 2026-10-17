import { evaluatePath, type CurrentPath } from '@shared/pathProgress'
import type { PathRepository } from './pathRepository'
import type { SessionRepository } from './sessionRepository'

// Keeps the progress of the path being followed up to date with the sessions that were saved, and
// decides which steps the person may mark by hand.
export class PathProgressService {
  constructor(
    private readonly paths: PathRepository,
    private readonly sessions: SessionRepository,
    private readonly now: () => number = Date.now
  ) {}

  // The path being followed, with how far it has got. The steps that the sessions completed are
  // marked done for good (they stay done even if the sessions are deleted later), and the path is
  // marked completed when its last step is done.
  current(): CurrentPath | null {
    const path = this.paths.getCurrent()
    if (!path) return null

    const sessions = this.sessions.list()
    const progress = evaluatePath(path, sessions)

    for (const step of progress.steps) {
      const stored = path.steps.find((candidate) => candidate.id === step.stepId)
      if (step.state === 'done' && stored?.doneAt === null && step.completedAt !== null) {
        this.paths.setStepDone(step.stepId, step.completedAt)
      }
    }

    const status = progress.completed ? 'completed' : 'active'
    if (status !== path.status) this.paths.setStatus(path.id, status)

    const fresh = this.paths.get(path.id)
    return fresh ? { path: fresh, progress: evaluatePath(fresh, sessions) } : null
  }

  // Marks an auxiliary step as done, or not done. Only those are marked by hand: a skill step is
  // completed by practising. A step can be marked once the ones before are done, and unmarked only
  // while nothing after it is done. Returns whether anything changed.
  setStepDone(stepId: number, done: boolean): boolean {
    const pathId = this.paths.pathOfStep(stepId)
    if (pathId === null) return false

    // Bring the path up to date first, so that "the ones before are done" is true to date.
    const current = this.current()
    const path = current?.path.id === pathId ? current.path : null
    const step = path?.steps.find((candidate) => candidate.id === stepId)
    if (!path || !step || step.kind !== 'auxiliary') return false

    const before = path.steps.filter((candidate) => candidate.position < step.position)
    const after = path.steps.filter((candidate) => candidate.position > step.position)
    if (done && before.some((candidate) => candidate.doneAt === null)) return false
    if (!done && after.some((candidate) => candidate.doneAt !== null)) return false

    this.paths.setStepDone(stepId, done ? this.now() : null)
    // A path that was completed is open again if a step is unmarked.
    this.current()
    return true
  }
}
