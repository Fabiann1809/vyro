import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { migrate, openDatabase } from './database'
import { MIGRATIONS } from './migrations'

const tables = (db: DatabaseSync): string[] =>
  (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>
  )
    .map((row) => row.name)
    .sort()

const version = (db: DatabaseSync): number =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version

describe('migrations list', () => {
  it('numbers the migrations 1, 2, 3... without gaps', () => {
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual(
      MIGRATIONS.map((_, index) => index + 1)
    )
  })
})

describe('openDatabase', () => {
  it('creates the tables of a new database', () => {
    const db = openDatabase(':memory:')

    expect(tables(db)).toEqual(['rep_errors', 'reps', 'sessions', 'settings'])
    expect(version(db)).toBe(MIGRATIONS.length)
  })

  it('enforces the links between tables', () => {
    const db = openDatabase(':memory:')

    expect(() =>
      db
        .prepare(
          'INSERT INTO reps (session_id, rep_index, quality, duration_ms) VALUES (?, ?, ?, ?)'
        )
        .run(999, 1, 'good', 2000)
    ).toThrow()
  })

  it('removes the repetitions and errors of a deleted session', () => {
    const db = openDatabase(':memory:')
    db.exec("INSERT INTO sessions (skill_id, started_at, duration_ms) VALUES ('squat', 0, 1000)")
    db.exec(
      "INSERT INTO reps (session_id, rep_index, quality, duration_ms) VALUES (1, 1, 'bad', 2000)"
    )
    db.exec("INSERT INTO rep_errors (rep_id, rule_id) VALUES (1, 'depth')")

    db.exec('DELETE FROM sessions')

    expect((db.prepare('SELECT COUNT(*) AS n FROM rep_errors').get() as { n: number }).n).toBe(0)
  })
})

describe('migrate', () => {
  it('does nothing when the database is already up to date', () => {
    const db = openDatabase(':memory:')
    db.exec("INSERT INTO settings (key, value) VALUES ('language', 'es')")

    migrate(db)

    expect((db.prepare('SELECT COUNT(*) AS n FROM settings').get() as { n: number }).n).toBe(1)
  })

  it('applies only the migrations that are missing, keeping the data', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, MIGRATIONS)
    db.exec("INSERT INTO settings (key, value) VALUES ('language', 'es')")

    migrate(db, [
      ...MIGRATIONS,
      { version: MIGRATIONS.length + 1, sql: 'ALTER TABLE sessions ADD COLUMN note TEXT' }
    ])

    expect(version(db)).toBe(MIGRATIONS.length + 1)
    expect((db.prepare('SELECT COUNT(*) AS n FROM settings').get() as { n: number }).n).toBe(1)
    expect(() => db.prepare('SELECT note FROM sessions').all()).not.toThrow()
  })

  it('leaves the database as it was when a migration fails', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db, MIGRATIONS)
    const broken = {
      version: MIGRATIONS.length + 1,
      sql: 'CREATE TABLE half_done (id INTEGER); THIS IS NOT SQL'
    }

    expect(() => migrate(db, [...MIGRATIONS, broken])).toThrow()
    expect(version(db)).toBe(MIGRATIONS.length)
    expect(tables(db)).not.toContain('half_done')
  })

  it('refuses a database made by a newer version of the app', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 5}`)

    expect(() => migrate(db)).toThrow(/newer than this app understands/)
  })
})
