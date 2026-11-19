import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

// Stands in for what Supabase already has: the auth schema, `auth.uid()` and the two roles.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant select on auth.users to authenticated;
  insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
`

let db: PGlite

async function actAs(userId: string | null): Promise<void> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId ?? ''}', false);`)
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'};`)
}

async function addSession(userId: string, skill: string): Promise<string> {
  await actAs(userId)
  const result = await db.query<{ id: string }>(
    `insert into public.sessions (skill_id, started_at, duration_ms, score, updated_at)
     values ($1, 1000, 60000, 80, 1000) returning id`,
    [skill]
  )
  const row = result.rows[0]
  if (!row) throw new Error('the insert returned no row')
  return row.id
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  const sql = readFileSync(
    resolve(__dirname, '../../../supabase/migrations/20261118000000_sync_schema.sql'),
    'utf8'
  )
  await db.exec(sql)
})

describe('the cloud schema keeps each user apart', () => {
  it('shows a user only their own rows', async () => {
    await addSession(ALICE, 'squat')
    await addSession(BOB, 'pushup')

    await actAs(ALICE)
    const rows = await db.query<{ skill_id: string }>('select skill_id from public.sessions')
    expect(rows.rows.map((r) => r.skill_id)).toEqual(['squat'])
  })

  it('refuses to write a row for another user', async () => {
    await actAs(ALICE)
    await expect(
      db.query(
        `insert into public.sessions (user_id, skill_id, started_at, duration_ms, updated_at)
         values ($1, 'squat', 1, 1, 1)`,
        [BOB]
      )
    ).rejects.toThrow(/row-level security/)
  })

  it('does not let a user change or delete the rows of another', async () => {
    await actAs(BOB)
    const updated = await db.query(`update public.sessions set score = 0 where skill_id = 'squat'`)
    const deleted = await db.query(`delete from public.sessions where skill_id = 'squat'`)
    expect(updated.affectedRows).toBe(0)
    expect(deleted.affectedRows).toBe(0)

    await actAs(ALICE)
    const rows = await db.query('select score from public.sessions')
    expect(rows.rows).toEqual([{ score: 80 }])
  })

  it('does not let a user move their own row to another user', async () => {
    await actAs(ALICE)
    await expect(
      db.query(`update public.sessions set user_id = $1 where skill_id = 'squat'`, [BOB])
    ).rejects.toThrow(/row-level security/)
  })

  it('refuses a repetition that points at a session of another user', async () => {
    const bobSession = await addSession(BOB, 'curl')
    await actAs(ALICE)
    await expect(
      db.query(
        `insert into public.reps (session_id, rep_index, quality, duration_ms, updated_at)
         values ($1, 1, 'good', 1000, 1)`,
        [bobSession]
      )
    ).rejects.toThrow(/foreign key/)
  })

  it('gives nothing to a visitor without a session', async () => {
    await actAs(null)
    await expect(db.query('select * from public.sessions')).rejects.toThrow(/permission denied/)
    await expect(
      db.query(
        `insert into public.sessions (skill_id, started_at, duration_ms, updated_at)
         values ('squat', 1, 1, 1)`
      )
    ).rejects.toThrow(/permission denied/)
  })

  it('applies the same rule to every table', async () => {
    await actAs('')
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r'`
    )
    expect(tables.rows.map((r) => r.relname).sort()).toEqual([
      'custom_skills',
      'learning_paths',
      'path_steps',
      'rep_errors',
      'reps',
      'sessions'
    ])
    expect(tables.rows.every((r) => r.relrowsecurity)).toBe(true)
  })
})
