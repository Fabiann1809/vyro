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
