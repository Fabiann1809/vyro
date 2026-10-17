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
  },
  {
    version: 2,
    sql: `
      CREATE TABLE learning_paths (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived'))
      );

      CREATE TABLE path_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path_id INTEGER NOT NULL REFERENCES learning_paths (id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('skill', 'auxiliary')),
        skill_id TEXT,
        criterion_sessions INTEGER,
        criterion_score INTEGER,
        done_at INTEGER,
        UNIQUE (path_id, position),
        -- A skill step is measured, an auxiliary one is not: the database refuses anything in between.
        CHECK (
          (kind = 'skill' AND skill_id IS NOT NULL AND criterion_sessions IS NOT NULL AND criterion_score IS NOT NULL)
          OR (kind = 'auxiliary' AND skill_id IS NULL AND criterion_sessions IS NULL AND criterion_score IS NULL)
        )
      );
      CREATE INDEX path_steps_by_path ON path_steps (path_id, position);
    `
  },
  {
    version: 3,
    sql: `
      CREATE TABLE custom_skills (
        id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'approved')),
        created_at INTEGER NOT NULL
      );
    `
  },
  {
    version: 4,
    sql: `
      CREATE TABLE ai_usage (
        day TEXT PRIMARY KEY,
        tokens INTEGER NOT NULL
      );
    `
  }
]
