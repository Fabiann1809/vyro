import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { CustomSkillRepository } from '../db/customSkillRepository'
import { openDatabase, type Database } from '../db/database'
import { PathRepository } from '../db/pathRepository'
import { SessionRepository } from '../db/sessionRepository'
import { SyncError } from './remote'
import { SyncService } from './syncService'
import { SYNC_TABLES, TABLE_SPECS, type SyncTable } from './tables'
import { Cloud, offlineAfter, type Received } from './testing/pgliteRemote'

const ANA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const BOB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

let cloud: Cloud

beforeAll(async () => {
  cloud = await Cloud.create([ANA, BOB])
  // Starting Postgres in memory is slow when the whole suite runs at once, hence the long limit.
}, 60_000)

beforeEach(() => cloud.reset())

interface Computer {
  db: Database
  sessions: SessionRepository
  paths: PathRepository
  skills: CustomSkillRepository
  sync: SyncService
  log: Received[]
}

// One computer of an account: its own local database and a way to the shared cloud.
function computer(user = ANA): Computer {
  const db = openDatabase(':memory:')
  const log: Received[] = []
  return {
    db,
    sessions: new SessionRepository(db),
    paths: new PathRepository(db),
    skills: new CustomSkillRepository(db),
    sync: new SyncService(db, cloud.storeFor(user, log)),
    log
  }
}

const count = (db: Database, sql: string): number =>
  (db.prepare(`SELECT count(*) AS n FROM ${sql}`).get() as { n: number }).n

function addSession(c: Computer): number {
  return c.sessions.save({
    skillId: 'squat',
    startedAt: 1000,
    durationMs: 60_000,
    score: 80,
    reps: [
      { index: 1, quality: 'bad', durationMs: 2000, failedRuleIds: ['depth', 'torso'] },
      { index: 2, quality: 'good', durationMs: 2100, failedRuleIds: [] }
    ]
  })
}

function addPath(c: Computer): number {
  return c.paths.create(
    {
      goal: 'Mejorar la sentadilla',
      steps: [
        {
          kind: 'skill',
          title: 'Sentadilla',
          description: 'Baja con control',
          skillId: 'squat',
          criterionSessions: 3,
          criterionScore: 70
        },
        {
          kind: 'auxiliary',
          title: 'Descanso',
          description: 'Un día libre',
          skillId: null,
          criterionSessions: null,
          criterionScore: null
        }
      ]
    },
    5000
  )
}

const later = (): number => Date.now() + 60_000

// The rows of the cloud that nobody deleted: a delete leaves the row, marked, for the others to see.
async function alive(table: SyncTable): Promise<unknown[]> {
  return (await cloud.rows(ANA, table)).filter((row) => row['deleted_at'] === null)
}

describe('going up', () => {
  it('uploads everything that was made, and nothing is waiting afterwards', async () => {
    const a = computer()
    addSession(a)
    addPath(a)
    a.skills.save('custom_a', { name: 'a' }, 'approved', 1)
    expect(a.sync.hasPending()).toBe(true)

    const report = await a.sync.run()

    // 1 session + 2 reps + 2 errors + 1 path + 2 steps + 1 skill.
    expect(report.uploaded).toBe(9)
    expect(a.sync.hasPending()).toBe(false)
    expect((await cloud.rows(ANA, 'sessions')).length).toBe(1)
    expect((await cloud.rows(ANA, 'reps')).length).toBe(2)
    expect((await cloud.rows(ANA, 'rep_errors')).length).toBe(2)
    expect((await cloud.rows(ANA, 'learning_paths')).length).toBe(1)
    expect((await cloud.rows(ANA, 'path_steps')).length).toBe(2)
    expect((await cloud.rows(ANA, 'custom_skills')).length).toBe(1)

    // A second round has nothing to say.
    expect((await a.sync.run()).uploaded).toBe(0)
  })

  it('keeps a skill that is still a draft on this computer', async () => {
    const a = computer()
    a.skills.save('custom_draft', { name: 'd' }, 'draft', 1)
    a.skills.save('custom_ok', { name: 'ok' }, 'approved', 1)
    await a.sync.run()
    const uploaded = (await cloud.rows(ANA, 'custom_skills')).map((row) => row['id'])
    expect(uploaded).toEqual(['custom_ok'])

    // Once approved, it goes up.
    a.skills.setStatus('custom_draft', 'approved')
    await a.sync.run()
    expect((await cloud.rows(ANA, 'custom_skills')).length).toBe(2)
  })

  it('sends a changed row again, and only that one', async () => {
    const a = computer()
    addPath(a)
    await a.sync.run()
    const stepId = a.db.prepare('SELECT id FROM path_steps WHERE kind = ?').get('auxiliary') as {
      id: number
    }
    a.paths.setStepDone(stepId.id, 7777)

    const report = await a.sync.run()
    expect(report.uploaded).toBe(1)
    const steps = await cloud.rows(ANA, 'path_steps')
    expect(steps.find((row) => row['kind'] === 'auxiliary')?.['done_at']).toBe(7777)
  })
})

describe('two computers', () => {
  it('bring each other the data, with every row pointing at its own parent', async () => {
    const a = computer()
    addSession(a)
    addPath(a)
    await a.sync.run()

    const b = computer()
    const report = await b.sync.run()

    expect(report.downloaded).toBe(8)
    expect(count(b.db, 'sessions')).toBe(1)
    expect(count(b.db, 'reps')).toBe(2)
    expect(count(b.db, 'rep_errors')).toBe(2)
    expect(count(b.db, 'path_steps')).toBe(2)
    const linked = b.db
      .prepare(
        `SELECT s.skill_id, r.rep_index, e.rule_id FROM rep_errors e
         JOIN reps r ON r.id = e.rep_id JOIN sessions s ON s.id = r.session_id ORDER BY e.rule_id`
      )
      .all() as Array<{ skill_id: string; rep_index: number; rule_id: string }>
    expect(linked).toEqual([
      { skill_id: 'squat', rep_index: 1, rule_id: 'depth' },
      { skill_id: 'squat', rep_index: 1, rule_id: 'torso' }
    ])
    // What came down is in step: it does not go back up.
    expect(b.sync.hasPending()).toBe(false)
    expect((await b.sync.run()).uploaded).toBe(0)
  })

  it('bring a change made on the other one', async () => {
    const a = computer()
    const pathId = addPath(a)
    await a.sync.run()
    const b = computer()
    await b.sync.run()

    a.paths.setStatus(pathId, 'archived')
    await a.sync.run()
    await b.sync.run()

    const status = b.db.prepare('SELECT status FROM learning_paths').get() as { status: string }
    expect(status.status).toBe('archived')
    expect(b.sync.hasPending()).toBe(false)
  })

  it('bring a delete made on the other one, with what hangs from it', async () => {
    const a = computer()
    const pathId = addPath(a)
    addSession(a)
    await a.sync.run()
    const b = computer()
    await b.sync.run()
    expect(count(b.db, 'learning_paths')).toBe(1)

    a.paths.delete(pathId)
    a.sessions.deleteAll()
    const report = await a.sync.run()
    expect(report.deleted).toBeGreaterThan(0)
    expect((await alive('learning_paths')).length).toBe(0)
    expect((await alive('path_steps')).length).toBe(0)
    expect((await alive('sessions')).length).toBe(0)

    await b.sync.run()
    expect(count(b.db, 'learning_paths')).toBe(0)
    expect(count(b.db, 'path_steps')).toBe(0)
    expect(count(b.db, 'sessions')).toBe(0)
    expect(count(b.db, 'sync_tombstones')).toBe(0)
  })

  it('do not bring back a row that was deleted here and not yet told to the cloud', async () => {
    const a = computer()
    addSession(a)
    await a.sync.run()
    const b = computer()
    await b.sync.run()

    // B deletes the session; the cloud still has it, and B syncs: the delete goes first.
    b.sessions.deleteAll()
    await b.sync.run()

    expect(count(b.db, 'sessions')).toBe(0)
    expect((await alive('sessions')).length).toBe(0)
  })

  it('keep a created skill, by its own id, and its changes', async () => {
    const a = computer()
    a.skills.save('custom_a', { name: 'uno' }, 'approved', 1)
    await a.sync.run()
    const b = computer()
    await b.sync.run()
    expect(b.skills.get('custom_a')?.config).toEqual({ name: 'uno' })

    a.skills.updateConfig('custom_a', { name: 'dos' })
    await a.sync.run()
    await b.sync.run()
    expect(b.skills.get('custom_a')?.config).toEqual({ name: 'dos' })
  })

  it('move the steps of a path around without tripping over their positions', async () => {
    const a = computer()
    addPath(a)
    await a.sync.run()
    const b = computer()
    await b.sync.run()

    // A swaps the two steps.
    a.db.exec(`
      UPDATE path_steps SET position = 100 WHERE position = 1;
      UPDATE path_steps SET position = 1 WHERE position = 2;
      UPDATE path_steps SET position = 2 WHERE position = 100;
      UPDATE path_steps SET updated_at = ${later()};
    `)
    await a.sync.run()
    const report = await b.sync.run()

    expect(report.skipped).toBe(0)
    const order = b.db.prepare('SELECT kind FROM path_steps ORDER BY position').all() as Array<{
      kind: string
    }>
    expect(order.map((row) => row.kind)).toEqual(['auxiliary', 'skill'])
  })
})

describe('when both changed the same row', () => {
  async function setup(): Promise<{ a: Computer; b: Computer; stepOf: (c: Computer) => number }> {
    const a = computer()
    addPath(a)
    await a.sync.run()
    const b = computer()
    await b.sync.run()
    const stepOf = (c: Computer): number =>
      (c.db.prepare("SELECT id FROM path_steps WHERE kind = 'auxiliary'").get() as { id: number })
        .id
    return { a, b, stepOf }
  }

  const doneAt = (c: Computer): number | null =>
    (
      c.db.prepare("SELECT done_at FROM path_steps WHERE kind = 'auxiliary'").get() as {
        done_at: number | null
      }
    ).done_at

  it('keeps the latest change, whichever computer syncs first', async () => {
    for (const order of ['older first', 'newer first'] as const) {
      await cloud.reset()
      const { a, b, stepOf } = await setup()
      const now = Date.now()
      a.paths.setStepDone(stepOf(a), 111)
      a.db.exec(`UPDATE path_steps SET updated_at = ${now + 10_000} WHERE kind = 'auxiliary'`)
      b.paths.setStepDone(stepOf(b), 222)
      b.db.exec(`UPDATE path_steps SET updated_at = ${now + 20_000} WHERE kind = 'auxiliary'`)

      const [first, second] = order === 'older first' ? [a, b] : [b, a]
      await first.sync.run()
      await second.sync.run()
      await first.sync.run()

      // B's change is the later one.
      expect(doneAt(a), order).toBe(222)
      expect(doneAt(b), order).toBe(222)
      const cloudRow = (await cloud.rows(ANA, 'path_steps')).find(
        (row) => row['kind'] === 'auxiliary'
      )
      expect(cloudRow?.['done_at'], order).toBe(222)
    }
  })
})

describe('without a connection', () => {
  it('fails with a kind of failure, loses nothing, and finishes on the next try', async () => {
    const a = computer()
    addSession(a)
    addPath(a)
    // The connection drops after the second call.
    const flaky = new SyncService(a.db, offlineAfter(cloud.storeFor(ANA), 2))

    await expect(flaky.run()).rejects.toBeInstanceOf(SyncError)
    expect(a.sync.hasPending()).toBe(true)
    expect(count(a.db, 'sessions')).toBe(1)

    // Back online: it finishes, and nothing is there twice.
    await a.sync.run()
    expect(a.sync.hasPending()).toBe(false)
    expect((await cloud.rows(ANA, 'sessions')).length).toBe(1)
    expect((await cloud.rows(ANA, 'reps')).length).toBe(2)
    expect((await cloud.rows(ANA, 'path_steps')).length).toBe(2)
  })

  it('keeps a delete until the cloud has heard of it', async () => {
    const a = computer()
    addSession(a)
    await a.sync.run()
    a.sessions.deleteAll()

    const offline = new SyncService(a.db, offlineAfter(cloud.storeFor(ANA), 0))
    await expect(offline.run()).rejects.toBeInstanceOf(SyncError)
    expect(a.sync.hasPending()).toBe(true)
    expect((await alive('sessions')).length).toBe(1)

    await a.sync.run()
    expect((await alive('sessions')).length).toBe(0)
    expect(a.sync.hasPending()).toBe(false)
  })

  it('answers a second request with the round that is already going on', async () => {
    const a = computer()
    addSession(a)
    const [first, second] = [a.sync.run(), a.sync.run()]
    expect(first).toBe(second)
    await first
  })
})

describe('what leaves the computer', () => {
  it('is only the listed tables and columns, and never the settings, the AI or the chat', async () => {
    const a = computer()
    addSession(a)
    addPath(a)
    a.skills.save('custom_a', { name: 'a' }, 'approved', 1)
    // Things that must never leave, with a mark that would be easy to spot.
    a.db.exec(`
      INSERT INTO settings (key, value) VALUES ('aiBaseUrl', '"http://SECRET-HOST.example"');
      INSERT INTO settings (key, value) VALUES ('cameraId', '"SECRET-CAMERA"');
      INSERT INTO ai_usage (day, tokens) VALUES ('2026-11-18', 987654321);
    `)

    await a.sync.run()

    const allowed = new Map<SyncTable, Set<string>>(
      TABLE_SPECS.map((spec) => [
        spec.name,
        new Set(['id', 'updated_at', ...spec.columns, ...(spec.parent ? [spec.parent.column] : [])])
      ])
    )
    expect(a.log.length).toBeGreaterThan(0)
    for (const call of a.log) {
      expect(SYNC_TABLES).toContain(call.table)
      for (const row of call.rows) {
        for (const column of Object.keys(row)) {
          expect(allowed.get(call.table)?.has(column), `${call.table}.${column}`).toBe(true)
        }
      }
    }
    const everything = JSON.stringify(a.log)
    for (const secret of ['SECRET-HOST', 'SECRET-CAMERA', '987654321', 'aiBaseUrl']) {
      expect(everything).not.toContain(secret)
    }
  })

  it('stays in the account: another account sees nothing of it', async () => {
    const a = computer(ANA)
    addSession(a)
    await a.sync.run()

    const intruder = computer(BOB)
    const report = await intruder.sync.run()
    expect(report.downloaded).toBe(0)
    expect(count(intruder.db, 'sessions')).toBe(0)
  })
})

describe('erasing the copy in the cloud', () => {
  async function everything(user: string): Promise<number> {
    let total = 0
    for (const table of SYNC_TABLES) total += (await cloud.rows(user, table)).length
    return total
  }

  it('erases the rows for good, not just marks them, and leaves other accounts alone', async () => {
    const a = computer(ANA)
    addSession(a)
    addPath(a)
    await a.sync.run()
    const other = computer(BOB)
    addSession(other)
    await other.sync.run()
    expect(await everything(ANA)).toBeGreaterThan(0)

    // The person deletes all their data here and asks for the cloud copy to go too.
    a.sessions.deleteAll()
    a.paths.deleteAll()
    a.sync.requestErase()
    expect(a.sync.hasPending()).toBe(true)
    await a.sync.run()

    expect(await everything(ANA)).toBe(0)
    expect(await everything(BOB)).toBeGreaterThan(0)
    expect(a.sync.hasPending()).toBe(false)
    expect(count(a.db, 'sync_tombstones')).toBe(0)
  })

  it('is not forgotten when there is no connection, and is done as soon as there is one', async () => {
    const a = computer()
    addSession(a)
    await a.sync.run()
    a.sessions.deleteAll()
    a.sync.requestErase()

    const offline = new SyncService(a.db, offlineAfter(cloud.storeFor(ANA), 0))
    await expect(offline.run()).rejects.toBeInstanceOf(SyncError)
    expect(a.sync.hasPending()).toBe(true)
    expect(await everything(ANA)).toBeGreaterThan(0)

    await a.sync.run()
    expect(await everything(ANA)).toBe(0)
  })

  it('sends again, as new, what is still kept here', async () => {
    const a = computer()
    addSession(a)
    await a.sync.run()
    a.sync.requestErase()
    await a.sync.run()

    // The copy was erased and the data here was not: it is uploaded again in the same round.
    expect((await cloud.rows(ANA, 'sessions')).length).toBe(1)
    expect(a.sync.hasPending()).toBe(false)
  })

  it('leaves the copy that another computer keeps alone, and does not bring it back on its own', async () => {
    const a = computer()
    addSession(a)
    await a.sync.run()
    const b = computer()
    await b.sync.run()
    expect(count(b.db, 'sessions')).toBe(1)

    a.sessions.deleteAll()
    a.sync.requestErase()
    await a.sync.run()
    await b.sync.run()

    // The erase is for good: it leaves no mark for B to follow. B keeps what it has, considers it
    // uploaded, and so the cloud stays empty until B changes something.
    expect(count(b.db, 'sessions')).toBe(1)
    expect((await cloud.rows(ANA, 'sessions')).length).toBe(0)
  })
})

describe('what comes down is not trusted', () => {
  it('leaves out a row that is not valid and goes on with the rest', async () => {
    const a = computer()
    addPath(a)
    await a.sync.run()

    // A row that the person (or someone with their session) wrote with a goal that is far too long.
    await cloud.actAs(ANA)
    const db = (cloud as unknown as { db: import('@electric-sql/pglite').PGlite }).db
    await db.query(
      "insert into public.learning_paths (goal, created_at, status, updated_at) values ($1, 1, 'active', $2)",
      ['x'.repeat(6000), Date.now()]
    )

    const b = computer()
    const report = await b.sync.run()
    expect(report.skipped).toBe(1)
    expect(count(b.db, 'learning_paths')).toBe(1)
    expect(count(b.db, 'path_steps')).toBe(2)
  })
})
