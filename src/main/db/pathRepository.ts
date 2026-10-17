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
