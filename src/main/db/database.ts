import { DatabaseSync } from 'node:sqlite'
import { MIGRATIONS, type Migration } from './migrations'

export type Database = DatabaseSync

const userVersion = (db: Database): number => {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined
  return row?.user_version ?? 0
}

// Brings the database up to date. Each migration runs in its own transaction, so a failure
// leaves the database at the last version that worked. The version lives in the file itself
// (SQLite's user_version), so there is no extra table to keep.
export function migrate(db: Database, migrations: readonly Migration[] = MIGRATIONS): void {
  const current = userVersion(db)
  const latest = migrations[migrations.length - 1]?.version ?? 0

  if (current > latest) {
    throw new Error(
      `The database is at version ${current}, newer than this app understands (${latest}). Update VYRO.`
    )
  }

  for (const migration of migrations.filter((candidate) => candidate.version > current)) {
    db.exec('BEGIN')
    try {
      db.exec(migration.sql)
      // PRAGMA does not take parameters; the version is a number we control.
      db.exec(`PRAGMA user_version = ${Math.trunc(migration.version)}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}

// Opens (and creates, if needed) the database at the path, ready to use. Use ':memory:' in tests.
export function openDatabase(path: string): Database {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}
