import type { CustomSkillRecord, CustomSkillStatus } from '@shared/customSkills'
import type { Database } from './database'

interface CustomSkillDbRow {
  id: string
  config_json: string
  status: CustomSkillStatus
  created_at: number
}

// A skill is a JSON config. Its contents are checked before they are saved (the schema of a skill
// lives in shared/skill) and again when the page loads them, so a damaged row costs one skill and
// never the app.
export class CustomSkillRepository {
  constructor(private readonly db: Database) {}

  // Saves a new skill; an id that already exists is an error.
  save(id: string, config: unknown, status: CustomSkillStatus, createdAt: number): void {
    this.db
      .prepare(
        'INSERT INTO custom_skills (id, config_json, status, created_at) VALUES (?, ?, ?, ?)'
      )
      .run(id, JSON.stringify(config), status, createdAt)
  }

  // Keeps this skill as the only draft: the one that was being looked at is dropped. Drafts are
  // never offered to train, and only one is worked on at a time.
  replaceDraft(id: string, config: unknown, createdAt: number): void {
    this.db.exec('BEGIN')
    try {
      this.db.exec("DELETE FROM custom_skills WHERE status = 'draft'")
      this.save(id, config, 'draft', createdAt)
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  // Replaces the JSON of a skill that exists; whether there was one.
  updateConfig(id: string, config: unknown): boolean {
    const result = this.db
      .prepare('UPDATE custom_skills SET config_json = ? WHERE id = ?')
      .run(JSON.stringify(config), id)
    return Number(result.changes) > 0
  }

  get(id: string): CustomSkillRecord | null {
    const row = this.db
      .prepare('SELECT id, config_json, status, created_at FROM custom_skills WHERE id = ?')
      .get(id) as CustomSkillDbRow | undefined
    return row ? toRecord(row) : null
  }

  // Oldest first. A row whose JSON cannot be read is left out.
  list(status?: CustomSkillStatus): CustomSkillRecord[] {
    const rows = (status === undefined
      ? this.db
          .prepare(
            'SELECT id, config_json, status, created_at FROM custom_skills ORDER BY created_at, id'
          )
          .all()
      : this.db
          .prepare(
            'SELECT id, config_json, status, created_at FROM custom_skills WHERE status = ? ORDER BY created_at, id'
          )
          .all(status)) as unknown as CustomSkillDbRow[]
    return rows.flatMap((row) => {
      const record = toRecord(row)
      return record ? [record] : []
    })
  }

  // Whether the skill exists.
  setStatus(id: string, status: CustomSkillStatus): boolean {
    const { changes } = this.db
      .prepare('UPDATE custom_skills SET status = ? WHERE id = ?')
      .run(status, id)
    return changes > 0
  }

  delete(id: string): boolean {
    const { changes } = this.db.prepare('DELETE FROM custom_skills WHERE id = ?').run(id)
    return changes > 0
  }

  deleteAll(): void {
    this.db.exec('DELETE FROM custom_skills')
  }
}

function toRecord(row: CustomSkillDbRow): CustomSkillRecord | null {
  try {
    return {
      id: row.id,
      config: JSON.parse(row.config_json) as unknown,
      status: row.status,
      createdAt: row.created_at
    }
  } catch {
    return null
  }
}
