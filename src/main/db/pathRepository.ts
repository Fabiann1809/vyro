import type { Adjustment } from '@shared/pathReview'
import type {
  LearningPath,
  PathStatus,
  PathStep,
  PathSummary,
  PathToSave,
  StepKind
} from '@shared/paths'
import type { Database } from './database'

interface PathDbRow {
  id: number
  goal: string
  created_at: number
  status: PathStatus
}

interface StepDbRow {
  id: number
  position: number
  title: string
  description: string
  kind: StepKind
  skill_id: string | null
  criterion_sessions: number | null
  criterion_score: number | null
  done_at: number | null
}

const toStep = (row: StepDbRow): PathStep => {
  const shared = {
    id: row.id,
    position: row.position,
    title: row.title,
    description: row.description,
    doneAt: row.done_at
  }
  // The table refuses a skill step without its measure, so these are never null for a skill.
  return row.kind === 'skill'
    ? {
        ...shared,
        kind: 'skill',
        skillId: row.skill_id ?? '',
        criterionSessions: row.criterion_sessions ?? 1,
        criterionScore: row.criterion_score ?? 0
      }
    : { ...shared, kind: 'auxiliary', skillId: null, criterionSessions: null, criterionScore: null }
}

export class PathRepository {
  constructor(private readonly db: Database) {}

  // Saves a path with its steps, in the order given, all or nothing. Returns its id.
  create(path: PathToSave, createdAt: number): number {
    this.db.exec('BEGIN')
    try {
      const { lastInsertRowid } = this.db
        .prepare('INSERT INTO learning_paths (goal, created_at, status) VALUES (?, ?, ?)')
        .run(path.goal, createdAt, 'active')
      const pathId = Number(lastInsertRowid)

      const insertStep = this.db.prepare(
        `INSERT INTO path_steps
           (path_id, position, title, description, kind, skill_id, criterion_sessions, criterion_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      path.steps.forEach((step, index) => {
        insertStep.run(
          pathId,
          index + 1,
          step.title,
          step.description,
          step.kind,
          step.skillId,
          step.criterionSessions,
          step.criterionScore
        )
      })

      this.db.exec('COMMIT')
      return pathId
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  get(id: number): LearningPath | null {
    const row = this.db
      .prepare('SELECT id, goal, created_at, status FROM learning_paths WHERE id = ?')
      .get(id) as PathDbRow | undefined
    return row ? this.withSteps(row) : null
  }

  // The path on show: the newest one that is being followed or has just been completed.
  getCurrent(): LearningPath | null {
    const row = this.db
      .prepare(
        `SELECT id, goal, created_at, status FROM learning_paths
         WHERE status IN ('active', 'completed') ORDER BY created_at DESC, id DESC LIMIT 1`
      )
      .get() as PathDbRow | undefined
    return row ? this.withSteps(row) : null
  }

  // The path a step belongs to, or null if there is no such step.
  pathOfStep(stepId: number): number | null {
    const row = this.db.prepare('SELECT path_id FROM path_steps WHERE id = ?').get(stepId) as
      { path_id: number } | undefined
    return row?.path_id ?? null
  }

  // Newest first, with how far each one is.
  list(): PathSummary[] {
    const rows = this.db
      .prepare(
        `SELECT p.id, p.goal, p.created_at, p.status,
           COUNT(s.id) AS step_count,
           COUNT(s.done_at) AS done_count
         FROM learning_paths p
         LEFT JOIN path_steps s ON s.path_id = p.id
         GROUP BY p.id
         ORDER BY p.created_at DESC, p.id DESC`
      )
      .all() as unknown as Array<PathDbRow & { step_count: number; done_count: number }>
    return rows.map((row) => ({
      id: row.id,
      goal: row.goal,
      createdAt: row.created_at,
      status: row.status,
      stepCount: row.step_count,
      doneCount: row.done_count
    }))
  }

  // Marks a step as done (or, with null, as not done). Returns whether the step exists.
  setStepDone(stepId: number, doneAt: number | null): boolean {
    const { changes } = this.db
      .prepare('UPDATE path_steps SET done_at = ? WHERE id = ?')
      .run(doneAt, stepId)
    return changes > 0
  }

  setStatus(pathId: number, status: PathStatus): boolean {
    const { changes } = this.db
      .prepare('UPDATE learning_paths SET status = ? WHERE id = ?')
      .run(status, pathId)
    return changes > 0
  }

  // Applies the adjustments of a review, all or nothing. They are assumed to have been checked with
  // adjustmentProblems: this only does the work. Positions are renumbered at the end, in two moves
  // (out of the way, then into place) because the table does not allow two steps in one position,
  // not even for an instant.
  applyAdjustments(pathId: number, adjustments: readonly Adjustment[]): void {
    this.db.exec('BEGIN')
    try {
      const updateCriteria = this.db.prepare(
        'UPDATE path_steps SET criterion_sessions = ?, criterion_score = ? WHERE id = ? AND path_id = ?'
      )
      const remove = this.db.prepare('DELETE FROM path_steps WHERE id = ? AND path_id = ?')
      for (const adjustment of adjustments) {
        if (adjustment.type === 'change-criteria') {
          updateCriteria.run(
            adjustment.criterionSessions,
            adjustment.criterionScore,
            adjustment.stepId,
            pathId
          )
        } else if (adjustment.type === 'remove-step') {
          remove.run(adjustment.stepId, pathId)
        }
      }

      const order = (
        this.db
          .prepare('SELECT id FROM path_steps WHERE path_id = ? ORDER BY position')
          .all(pathId) as Array<{ id: number }>
      ).map((row) => row.id)

      const insert = this.db.prepare(
        `INSERT INTO path_steps
           (path_id, position, title, description, kind, skill_id, criterion_sessions, criterion_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      // Steps added after the same one keep the order in which they were given.
      const lastAddedAfter = new Map<number, number>()
      let temporaryPosition = 5_000_000
      for (const adjustment of adjustments) {
        if (adjustment.type !== 'add-step') continue
        const { step } = adjustment
        const id = Number(
          insert.run(
            pathId,
            temporaryPosition++,
            step.title,
            step.description,
            step.kind,
            step.skillId,
            step.criterionSessions,
            step.criterionScore
          ).lastInsertRowid
        )
        const anchor = lastAddedAfter.get(adjustment.afterStepId) ?? adjustment.afterStepId
        const at = order.indexOf(anchor)
        if (at === -1) throw new Error('A step cannot be added after one that is not in the path.')
        order.splice(at + 1, 0, id)
        lastAddedAfter.set(adjustment.afterStepId, id)
      }

      this.db
        .prepare('UPDATE path_steps SET position = position + 10000000 WHERE path_id = ?')
        .run(pathId)
      const place = this.db.prepare('UPDATE path_steps SET position = ? WHERE id = ?')
      order.forEach((id, index) => place.run(index + 1, id))

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  // Closes the paths on show, to make room for a new one.
  archiveCurrent(): void {
    this.db.exec(
      "UPDATE learning_paths SET status = 'archived' WHERE status IN ('active', 'completed')"
    )
  }

  delete(pathId: number): boolean {
    const { changes } = this.db.prepare('DELETE FROM learning_paths WHERE id = ?').run(pathId)
    return changes > 0
  }

  deleteAll(): void {
    this.db.exec('DELETE FROM learning_paths')
  }

  private withSteps(row: PathDbRow): LearningPath {
    const steps = this.db
      .prepare(
        `SELECT id, position, title, description, kind, skill_id, criterion_sessions,
                criterion_score, done_at
         FROM path_steps WHERE path_id = ? ORDER BY position`
      )
      .all(row.id) as unknown as StepDbRow[]
    return {
      id: row.id,
      goal: row.goal,
      createdAt: row.created_at,
      status: row.status,
      steps: steps.map(toStep)
    }
  }
}
