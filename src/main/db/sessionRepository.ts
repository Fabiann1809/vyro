import type {
  ErrorCount,
  RepQuality,
  RepRecord,
  SessionDetail,
  SessionQuery,
  SessionRow,
  SessionToSave
} from '@shared/sessions'
import type { Database } from './database'

interface SessionDbRow {
  id: number
  skill_id: string
  started_at: number
  duration_ms: number
  score: number | null
  rep_count: number
  good_count: number
  needs_work_count: number
  bad_count: number
}

// Totals are counted by the database, so the history never loads every repetition.
const SESSION_ROWS = `
  SELECT s.id, s.skill_id, s.started_at, s.duration_ms, s.score,
    COUNT(r.id) AS rep_count,
    COALESCE(SUM(r.quality = 'good'), 0) AS good_count,
    COALESCE(SUM(r.quality = 'needs-work'), 0) AS needs_work_count,
    COALESCE(SUM(r.quality = 'bad'), 0) AS bad_count
  FROM sessions s
  LEFT JOIN reps r ON r.session_id = s.id
`

const toSessionRow = (row: SessionDbRow): SessionRow => ({
  id: row.id,
  skillId: row.skill_id,
  startedAt: row.started_at,
  durationMs: row.duration_ms,
  score: row.score,
  repCount: row.rep_count,
  goodCount: row.good_count,
  needsWorkCount: row.needs_work_count,
  badCount: row.bad_count
})

export class SessionRepository {
  constructor(private readonly db: Database) {}

  // Saves a session with its repetitions and their errors, all or nothing. Returns its id.
  save(session: SessionToSave): number {
    this.db.exec('BEGIN')
    try {
      const { lastInsertRowid } = this.db
        .prepare(
          'INSERT INTO sessions (skill_id, started_at, duration_ms, score) VALUES (?, ?, ?, ?)'
        )
        .run(session.skillId, session.startedAt, session.durationMs, session.score)
      const sessionId = Number(lastInsertRowid)

      const insertRep = this.db.prepare(
        'INSERT INTO reps (session_id, rep_index, quality, duration_ms) VALUES (?, ?, ?, ?)'
      )
      const insertError = this.db.prepare('INSERT INTO rep_errors (rep_id, rule_id) VALUES (?, ?)')

      for (const rep of session.reps) {
        const repId = Number(
          insertRep.run(sessionId, rep.index, rep.quality, rep.durationMs).lastInsertRowid
        )
        for (const ruleId of rep.failedRuleIds) insertError.run(repId, ruleId)
      }

      this.db.exec('COMMIT')
      return sessionId
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  // Sessions from the newest to the oldest.
  list(query: SessionQuery = {}): SessionRow[] {
    const where = query.skillId === undefined ? '' : 'WHERE s.skill_id = ?'
    const limit = query.limit === undefined ? '' : 'LIMIT ?'
    const params = [
      ...(query.skillId === undefined ? [] : [query.skillId]),
      ...(query.limit === undefined ? [] : [query.limit])
    ]

    const rows = this.db
      .prepare(
        `${SESSION_ROWS} ${where} GROUP BY s.id ORDER BY s.started_at DESC, s.id DESC ${limit}`
      )
      .all(...params) as unknown as SessionDbRow[]
    return rows.map(toSessionRow)
  }

  get(id: number): SessionDetail | null {
    const row = this.db.prepare(`${SESSION_ROWS} WHERE s.id = ? GROUP BY s.id`).get(id) as
      SessionDbRow | undefined
    if (!row) return null

    return { ...toSessionRow(row), reps: this.repsOf(id) }
  }

  // How many times each rule was failed, the most frequent first.
  // Only the sessions that began after `since` (milliseconds since 1970), when it is given.
  errorCounts(skillId?: string, since?: number): ErrorCount[] {
    const conditions = [
      ...(skillId === undefined ? [] : ['s.skill_id = ?']),
      ...(since === undefined ? [] : ['s.started_at > ?'])
    ]
    const where = conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`
    const rows = this.db
      .prepare(
        `SELECT e.rule_id, COUNT(*) AS count
         FROM rep_errors e
         JOIN reps r ON r.id = e.rep_id
         JOIN sessions s ON s.id = r.session_id
         ${where}
         GROUP BY e.rule_id
         ORDER BY count DESC, e.rule_id`
      )
      .all(
        ...(skillId === undefined ? [] : [skillId]),
        ...(since === undefined ? [] : [since])
      ) as Array<{ rule_id: string; count: number }>
    return rows.map((row) => ({ ruleId: row.rule_id, count: row.count }))
  }

  deleteAll(): void {
    this.db.exec('DELETE FROM sessions')
  }

  private repsOf(sessionId: number): RepRecord[] {
    const reps = this.db
      .prepare(
        'SELECT id, rep_index, quality, duration_ms FROM reps WHERE session_id = ? ORDER BY rep_index'
      )
      .all(sessionId) as Array<{
      id: number
      rep_index: number
      quality: RepQuality
      duration_ms: number
    }>
    const errors = this.db
      .prepare(
        `SELECT e.rep_id, e.rule_id FROM rep_errors e
         JOIN reps r ON r.id = e.rep_id
         WHERE r.session_id = ? ORDER BY e.id`
      )
      .all(sessionId) as Array<{ rep_id: number; rule_id: string }>

    return reps.map((rep) => ({
      id: rep.id,
      index: rep.rep_index,
      quality: rep.quality,
      durationMs: rep.duration_ms,
      failedRuleIds: errors.filter((error) => error.rep_id === rep.id).map((e) => e.rule_id)
    }))
  }
}
