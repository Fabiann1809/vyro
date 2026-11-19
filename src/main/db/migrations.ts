// What the cloud sync (D21) needs from each table, added without touching any query that exists:
// triggers keep `updated_at` (milliseconds) up to date and note every delete of a synced row, so no
// repository has to know about syncing.
//  - remote_id: the id of the row in the cloud, null until it is uploaded (a created skill is keyed
//    by its own id, so it has none).
//  - synced_at: when the row was last in step with the cloud. A row is waiting to be uploaded when
//    it has no remote_id or was changed after synced_at.
const NOW_MS = "CAST(unixepoch('subsec') * 1000 AS INTEGER)"

function syncColumns(table: string, options: { remoteId: boolean; since: string }): string {
  const { remoteId, since } = options
  // A sync that only marks a row as synced must not make it look changed again.
  const untouched = remoteId
    ? 'NEW.updated_at = OLD.updated_at AND NEW.synced_at IS OLD.synced_at AND NEW.remote_id IS OLD.remote_id'
    : 'NEW.updated_at = OLD.updated_at AND NEW.synced_at IS OLD.synced_at'
  const key = remoteId ? 'OLD.remote_id' : 'OLD.id'
  const known = remoteId ? 'OLD.remote_id IS NOT NULL' : 'OLD.synced_at IS NOT NULL'
  return `
      ${remoteId ? `ALTER TABLE ${table} ADD COLUMN remote_id TEXT;` : ''}
      ALTER TABLE ${table} ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE ${table} ADD COLUMN synced_at INTEGER;
      ${remoteId ? `CREATE UNIQUE INDEX ${table}_by_remote ON ${table} (remote_id) WHERE remote_id IS NOT NULL;` : ''}
      UPDATE ${table} SET updated_at = ${since};

      CREATE TRIGGER ${table}_stamp_insert AFTER INSERT ON ${table} WHEN NEW.updated_at = 0
      BEGIN
        UPDATE ${table} SET updated_at = ${NOW_MS} WHERE rowid = NEW.rowid;
      END;
      CREATE TRIGGER ${table}_stamp_update AFTER UPDATE ON ${table} WHEN ${untouched}
      BEGIN
        UPDATE ${table} SET updated_at = ${NOW_MS} WHERE rowid = NEW.rowid;
      END;
      CREATE TRIGGER ${table}_note_delete AFTER DELETE ON ${table} WHEN ${known}
      BEGIN
        INSERT INTO sync_tombstones (table_name, row_key, deleted_at)
        VALUES ('${table}', ${key}, ${NOW_MS});
      END;`
}

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
  },
  {
    version: 5,
    // The guide of a step (tips and time) as JSON; the steps made before it have none.
    sql: `
      ALTER TABLE path_steps ADD COLUMN guide_json TEXT;
    `
  },
  {
    version: 6,
    // Cloud sync (D21). The data on this computer belongs to one account at a time (account_owner),
    // and a delete of a synced row is remembered in sync_tombstones until it reaches the cloud.
    sql: `
      CREATE TABLE account_owner (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        user_id TEXT NOT NULL,
        claimed_at INTEGER NOT NULL
      );

      CREATE TABLE sync_tombstones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        row_key TEXT NOT NULL,
        deleted_at INTEGER NOT NULL
      );

      ${syncColumns('sessions', { remoteId: true, since: 'started_at' })}
      ${syncColumns('reps', { remoteId: true, since: '(SELECT started_at FROM sessions WHERE sessions.id = reps.session_id)' })}
      ${syncColumns('rep_errors', { remoteId: true, since: '(SELECT started_at FROM sessions JOIN reps ON reps.session_id = sessions.id WHERE reps.id = rep_errors.rep_id)' })}
      ${syncColumns('learning_paths', { remoteId: true, since: 'created_at' })}
      ${syncColumns('path_steps', { remoteId: true, since: '(SELECT created_at FROM learning_paths WHERE learning_paths.id = path_steps.path_id)' })}
      ${syncColumns('custom_skills', { remoteId: false, since: 'created_at' })}
    `
  },
  {
    version: 7,
    // Where the download of each synced table got to: the latest `updated_at` already brought down.
    sql: `
      CREATE TABLE sync_state (
        table_name TEXT PRIMARY KEY,
        pulled_up_to INTEGER NOT NULL
      );
    `
  }
]
