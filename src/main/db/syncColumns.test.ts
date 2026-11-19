import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { migrate, openDatabase } from './database'
import { MIGRATIONS } from './migrations'

const SYNCED_TABLES = ['sessions', 'reps', 'rep_errors', 'learning_paths', 'path_steps']

const one = (db: DatabaseSync, sql: string): unknown => db.prepare(sql).get()

function tombstones(db: DatabaseSync): Array<{ table_name: string; row_key: string }> {
  return db.prepare('SELECT table_name, row_key FROM sync_tombstones ORDER BY id').all() as Array<{
    table_name: string
    row_key: string
  }>
}

const WAITING =
  'SELECT count(*) AS n FROM path_steps WHERE remote_id IS NULL OR updated_at > synced_at'

// A session with one repetition that has one error, all of them already uploaded.
function seedSynced(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO sessions (skill_id, started_at, duration_ms, remote_id) VALUES ('squat', 5000, 1000, 'rs1');
    INSERT INTO reps (session_id, rep_index, quality, duration_ms, remote_id) VALUES (1, 1, 'bad', 2000, 'rr1');
    INSERT INTO rep_errors (rep_id, rule_id, remote_id) VALUES (1, 'depth', 're1');
  `)
}

describe('migration 6 on a database that already has data', () => {
  it('keeps every row and dates it by when it was made', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    migrate(db, MIGRATIONS.slice(0, 5))
    db.exec(`
      INSERT INTO sessions (skill_id, started_at, duration_ms, score) VALUES ('squat', 111, 1000, 80);
      INSERT INTO reps (session_id, rep_index, quality, duration_ms) VALUES (1, 1, 'good', 2000);
      INSERT INTO rep_errors (rep_id, rule_id) VALUES (1, 'depth');
      INSERT INTO learning_paths (goal, created_at, status) VALUES ('goal', 222, 'active');
      INSERT INTO path_steps (path_id, position, title, description, kind)
        VALUES (1, 1, 'rest', 'rest', 'auxiliary');
      INSERT INTO custom_skills (id, config_json, status, created_at) VALUES ('custom_a', '{}', 'approved', 333);
    `)

    migrate(db)

    expect(one(db, 'SELECT count(*) AS n FROM sessions')).toEqual({ n: 1 })
    expect(one(db, 'SELECT updated_at, remote_id, synced_at FROM sessions')).toEqual({
      updated_at: 111,
      remote_id: null,
      synced_at: null
    })
    expect(one(db, 'SELECT updated_at FROM reps')).toEqual({ updated_at: 111 })
    expect(one(db, 'SELECT updated_at FROM rep_errors')).toEqual({ updated_at: 111 })
    expect(one(db, 'SELECT updated_at FROM learning_paths')).toEqual({ updated_at: 222 })
    expect(one(db, 'SELECT updated_at FROM path_steps')).toEqual({ updated_at: 222 })
    expect(one(db, 'SELECT updated_at, synced_at FROM custom_skills')).toEqual({
      updated_at: 333,
      synced_at: null
    })
  })
})

describe('updated_at', () => {
  it('is set when a row is made and moves forward when it changes', () => {
    const db = openDatabase(':memory:')
    const before = Date.now()
    db.exec("INSERT INTO learning_paths (goal, created_at, status) VALUES ('g', 1, 'active')")
    const made = (one(db, 'SELECT updated_at AS t FROM learning_paths') as { t: number }).t
    // SQLite rounds the clock a little differently from JavaScript, hence the 5 ms.
    expect(made).toBeGreaterThanOrEqual(before - 5)

    db.exec("UPDATE learning_paths SET updated_at = 5, status = 'archived'")
    expect(one(db, 'SELECT updated_at AS t FROM learning_paths')).toEqual({ t: 5 })

    db.exec("UPDATE learning_paths SET status = 'completed'")
    const changed = (one(db, 'SELECT updated_at AS t FROM learning_paths') as { t: number }).t
    expect(changed).toBeGreaterThan(5)
  })

  it('does not move when a row is only marked as uploaded', () => {
    const db = openDatabase(':memory:')
    db.exec("INSERT INTO sessions (skill_id, started_at, duration_ms) VALUES ('squat', 1, 1)")
    db.exec('UPDATE sessions SET updated_at = 700')
    db.exec("UPDATE sessions SET remote_id = 'r1', synced_at = 900")
    expect(one(db, 'SELECT updated_at, remote_id, synced_at FROM sessions')).toEqual({
      updated_at: 700,
      remote_id: 'r1',
      synced_at: 900
    })
  })

  it('keeps the date of a row that comes from the cloud', () => {
    const db = openDatabase(':memory:')
    db.exec(
      "INSERT INTO sessions (skill_id, started_at, duration_ms, remote_id, updated_at, synced_at) VALUES ('squat', 1, 1, 'r1', 4242, 4242)"
    )
    expect(one(db, 'SELECT updated_at AS t FROM sessions')).toEqual({ t: 4242 })
  })

  it('follows a change to a step, which is how a row becomes waiting to be uploaded', () => {
    const db = openDatabase(':memory:')
    db.exec(`
      INSERT INTO learning_paths (goal, created_at, status) VALUES ('g', 1, 'active');
      INSERT INTO path_steps (path_id, position, title, description, kind)
        VALUES (1, 1, 'rest', 'rest', 'auxiliary');
      UPDATE path_steps SET remote_id = 's1', synced_at = 1000, updated_at = 1000;
    `)
    expect(one(db, WAITING)).toEqual({ n: 0 })

    db.exec('UPDATE path_steps SET done_at = 5')
    expect(one(db, WAITING)).toEqual({ n: 1 })
  })
})

describe('deletes of synced rows', () => {
  it('are remembered, with the cloud id', () => {
    const db = openDatabase(':memory:')
    seedSynced(db)
    db.exec('DELETE FROM sessions')

    const notes = tombstones(db)
    // The session and what hung from it: the cloud removes the children with their parent too.
    expect(notes).toContainEqual({ table_name: 'sessions', row_key: 'rs1' })
    expect(notes).toContainEqual({ table_name: 'reps', row_key: 'rr1' })
    expect(notes).toContainEqual({ table_name: 'rep_errors', row_key: 're1' })
  })

  it('are not remembered for rows that never reached the cloud', () => {
    const db = openDatabase(':memory:')
    db.exec("INSERT INTO sessions (skill_id, started_at, duration_ms) VALUES ('squat', 1, 1)")
    db.exec('DELETE FROM sessions')
    expect(tombstones(db)).toEqual([])
  })

  it('remember a created skill by its own id, only once it was synced', () => {
    const db = openDatabase(':memory:')
    db.exec(`
      INSERT INTO custom_skills (id, config_json, status, created_at) VALUES ('custom_a', '{}', 'approved', 1);
      INSERT INTO custom_skills (id, config_json, status, created_at) VALUES ('custom_b', '{}', 'approved', 1);
      UPDATE custom_skills SET synced_at = 10 WHERE id = 'custom_a';
    `)
    db.exec('DELETE FROM custom_skills')
    expect(tombstones(db)).toEqual([{ table_name: 'custom_skills', row_key: 'custom_a' }])
  })

  it('cover every table that is synced', () => {
    const db = openDatabase(':memory:')
    for (const table of SYNCED_TABLES) {
      const triggers = (
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?")
          .all(table) as Array<{ name: string }>
      ).map((row) => row.name)
      expect(triggers.sort()).toEqual(
        [`${table}_note_delete`, `${table}_stamp_insert`, `${table}_stamp_update`].sort()
      )
    }
  })
})
