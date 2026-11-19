import type { LocalCounts } from '@shared/localData'
import type { Database } from './database'

const count = (db: Database, table: string): number =>
  (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n

// Who the data on this computer belongs to, and what is there. The data belongs to one account at a
// time: when another one signs in, the first one's data is already in the cloud and is cleared.
export class LocalData {
  constructor(private readonly db: Database) {}

  owner(): string | null {
    const row = this.db.prepare('SELECT user_id FROM account_owner WHERE id = 1').get() as
      { user_id: string } | undefined
    return row?.user_id ?? null
  }

  claim(userId: string, now: number): void {
    this.db
      .prepare(
        `INSERT INTO account_owner (id, user_id, claimed_at) VALUES (1, ?, ?)
         ON CONFLICT (id) DO UPDATE SET user_id = excluded.user_id, claimed_at = excluded.claimed_at`
      )
      .run(userId, now)
  }

  counts(): LocalCounts {
    return {
      sessions: count(this.db, 'sessions'),
      paths: count(this.db, 'learning_paths'),
      skills: count(this.db, 'custom_skills')
    }
  }

  isEmpty(): boolean {
    const { sessions, paths, skills } = this.counts()
    return sessions + paths + skills === 0
  }

  // Empties what belongs to an account: sessions, paths and created skills. The settings stay (they
  // belong to this computer), and so does the count of AI tokens used today.
  wipe(): void {
    this.db.exec('BEGIN')
    try {
      this.db.exec('DELETE FROM sessions')
      this.db.exec('DELETE FROM learning_paths')
      this.db.exec('DELETE FROM custom_skills')
      // The deletes above were noted for the cloud: they must not be sent for another account.
      this.db.exec('DELETE FROM sync_tombstones')
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}
