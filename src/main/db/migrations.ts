export interface Migration {
  // Strictly increasing, starting at 1. Never change a migration that has shipped: add a new one.
  version: number
  sql: string
}

// Only numbers and rule names are stored: no video, no images.
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        score INTEGER
      );
      CREATE INDEX sessions_by_skill ON sessions (skill_id, started_at);

      CREATE TABLE reps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        rep_index INTEGER NOT NULL,
        quality TEXT NOT NULL,
        duration_ms INTEGER NOT NULL
      );
      CREATE INDEX reps_by_session ON reps (session_id);

      CREATE TABLE rep_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rep_id INTEGER NOT NULL REFERENCES reps (id) ON DELETE CASCADE,
        rule_id TEXT NOT NULL
      );
      CREATE INDEX rep_errors_by_rep ON rep_errors (rep_id);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `
  }
]
