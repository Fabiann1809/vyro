import { describe, expect, it } from 'vitest'
import { LocalAdoption } from './adoption'
import { openDatabase, type Database } from './database'
import { LocalData } from './localData'

const ANA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const BOB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function setup(): { db: Database; data: LocalData; adoption: LocalAdoption } {
  const db = openDatabase(':memory:')
  const data = new LocalData(db)
  return { db, data, adoption: new LocalAdoption(data, () => 1234) }
}

// Data from before accounts: a session, a path and a skill.
function seed(db: Database): void {
  db.exec(`
    INSERT INTO sessions (skill_id, started_at, duration_ms) VALUES ('squat', 1, 1);
    INSERT INTO sessions (skill_id, started_at, duration_ms) VALUES ('pushup', 2, 1);
    INSERT INTO learning_paths (goal, created_at, status) VALUES ('goal', 1, 'active');
    INSERT INTO custom_skills (id, config_json, status, created_at) VALUES ('custom_a', '{}', 'approved', 1);
    INSERT INTO settings (key, value) VALUES ('language', '"en"');
  `)
}

const rows = (db: Database, table: string): number =>
  (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n

describe('LocalAdoption.check', () => {
  it('lets a first account claim a computer that has no data', () => {
    const { data, adoption } = setup()
    expect(adoption.check(ANA)).toEqual({ action: 'none' })
    expect(data.owner()).toBe(ANA)
  })

  it('asks what to do with the data that was made before accounts', () => {
    const { db, data, adoption } = setup()
    seed(db)
    expect(adoption.check(ANA)).toEqual({
      action: 'ask',
      counts: { sessions: 2, paths: 1, skills: 1 }
    })
    // Nothing is decided until the person answers.
    expect(data.owner()).toBeNull()
    expect(rows(db, 'sessions')).toBe(2)
  })

  it('has nothing to ask the account that already owns the data', () => {
    const { db, adoption } = setup()
    seed(db)
    adoption.resolve(ANA, true)
    expect(adoption.check(ANA)).toEqual({ action: 'none' })
    expect(rows(db, 'sessions')).toBe(2)
  })

  it('clears the data of the previous account when another one signs in', () => {
    const { db, data, adoption } = setup()
    seed(db)
    adoption.resolve(ANA, true)

    expect(adoption.check(BOB)).toEqual({ action: 'none' })
    expect(data.owner()).toBe(BOB)
    expect(data.counts()).toEqual({ sessions: 0, paths: 0, skills: 0 })
  })

  it('makes the next account download from the beginning, not from where the first one stopped', () => {
    const { db, adoption } = setup()
    adoption.resolve(ANA, true)
    db.exec("INSERT INTO sync_state (table_name, pulled_up_to) VALUES ('sessions', 999)")

    adoption.check(BOB)

    expect(rows(db, 'sync_state')).toBe(0)
  })

  it('does not send the first account’s deletes to the cloud of the second', () => {
    const { db, adoption } = setup()
    db.exec(
      "INSERT INTO sessions (skill_id, started_at, duration_ms, remote_id) VALUES ('squat', 1, 1, 'rs1')"
    )
    adoption.resolve(ANA, true)
    adoption.check(BOB)
    expect(rows(db, 'sync_tombstones')).toBe(0)
  })
})

describe('LocalAdoption.resolve', () => {
  it('keeps the data for the account, ready to be uploaded', () => {
    const { db, data, adoption } = setup()
    seed(db)
    adoption.resolve(ANA, true)

    expect(data.owner()).toBe(ANA)
    expect(data.counts()).toEqual({ sessions: 2, paths: 1, skills: 1 })
    expect(rows(db, 'sessions WHERE remote_id IS NULL')).toBe(2)
  })

  it('deletes the data when the person starts from zero, and keeps the settings', () => {
    const { db, data, adoption } = setup()
    seed(db)
    adoption.resolve(ANA, false)

    expect(data.owner()).toBe(ANA)
    expect(data.isEmpty()).toBe(true)
    expect(rows(db, 'settings')).toBe(1)
  })

  it('does not take the data of another account', () => {
    const { db, data, adoption } = setup()
    seed(db)
    adoption.resolve(ANA, true)

    expect(() => adoption.resolve(BOB, false)).toThrow(/another account/)
    expect(data.owner()).toBe(ANA)
    expect(rows(db, 'sessions')).toBe(2)
  })

  it('does nothing when the account already owns the data', () => {
    const { db, adoption } = setup()
    seed(db)
    adoption.resolve(ANA, true)
    adoption.resolve(ANA, false)
    expect(rows(db, 'sessions')).toBe(2)
  })
})
