import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

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
`

let db: PGlite

async function actAs(userId: string | null): Promise<void> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId ?? ''}', false);`)
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'};`)
}

// A session with a repetition, a path with a step and a skill, for one account.
async function fill(userId: string): Promise<void> {
  await db.exec('reset role')
  await db.exec(`
    insert into public.sessions (id, user_id, skill_id, started_at, duration_ms, updated_at)
      values (gen_random_uuid(), '${userId}', 'squat', 1, 1, 1);
    insert into public.reps (user_id, session_id, rep_index, quality, duration_ms, updated_at)
      select '${userId}', id, 1, 'good', 1, 1 from public.sessions where user_id = '${userId}';
    insert into public.learning_paths (id, user_id, goal, created_at, status, updated_at)
      values (gen_random_uuid(), '${userId}', 'g', 1, 'active', 1);
    insert into public.path_steps (user_id, path_id, position, title, description, kind, updated_at)
      select '${userId}', id, 1, 't', 'd', 'auxiliary', 1 from public.learning_paths where user_id = '${userId}';
    insert into public.custom_skills (user_id, id, config_json, status, created_at, updated_at)
      values ('${userId}', 'custom_a', '{}', 'approved', 1, 1);
  `)
}

async function rowsOf(userId: string): Promise<number> {
  await db.exec('reset role')
  let total = 0
  for (const table of ['sessions', 'reps', 'learning_paths', 'path_steps', 'custom_skills']) {
    const result = await db.query<{ n: number }>(
      `select count(*)::int as n from public.${table} where user_id = $1`,
      [userId]
    )
    total += result.rows[0]?.n ?? 0
  }
  return total
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  await db.exec(`insert into auth.users (id) values ('${ALICE}'), ('${BOB}')`)
  const folder = resolve(__dirname, '../../../supabase/migrations')
  for (const file of readdirSync(folder).sort()) {
    await db.exec(readFileSync(resolve(folder, file), 'utf8'))
  }
  // Starting Postgres in memory is slow when the whole suite runs at once, hence the long limit.
}, 60_000)

beforeEach(async () => {
  await db.exec('reset role')
  await db.exec('truncate public.sessions, public.learning_paths, public.custom_skills cascade')
  await db.exec(
    `insert into auth.users (id) values ('${ALICE}'), ('${BOB}') on conflict do nothing`
  )
  await fill(ALICE)
  await fill(BOB)
})

describe('delete_my_cloud_data', () => {
  it('erases everything of the caller, children included, and nothing of anyone else', async () => {
    expect(await rowsOf(ALICE)).toBe(5)
    await actAs(ALICE)
    await db.query('select public.delete_my_cloud_data()')

    expect(await rowsOf(ALICE)).toBe(0)
    expect(await rowsOf(BOB)).toBe(5)
  })

  it('leaves the account itself', async () => {
    await actAs(ALICE)
    await db.query('select public.delete_my_cloud_data()')
    await db.exec('reset role')
    const users = await db.query<{ n: number }>('select count(*)::int as n from auth.users')
    expect(users.rows[0]?.n).toBe(2)
  })

  it('refuses a call without a session', async () => {
    await actAs(null)
    await expect(db.query('select public.delete_my_cloud_data()')).rejects.toThrow(
      /permission denied/
    )
    expect(await rowsOf(ALICE)).toBe(5)
  })
})

describe('delete_my_account', () => {
  it('erases the account and all of its data, and nothing of anyone else', async () => {
    await actAs(ALICE)
    await db.query('select public.delete_my_account()')

    await db.exec('reset role')
    const users = await db.query<{ id: string }>('select id from auth.users')
    expect(users.rows.map((row) => row.id)).toEqual([BOB])
    expect(await rowsOf(ALICE)).toBe(0)
    expect(await rowsOf(BOB)).toBe(5)
  })

  it('refuses a call without a session', async () => {
    await actAs(null)
    await expect(db.query('select public.delete_my_account()')).rejects.toThrow(/permission denied/)
    await db.exec('reset role')
    const users = await db.query<{ n: number }>('select count(*)::int as n from auth.users')
    expect(users.rows[0]?.n).toBe(2)
  })

  it('also refuses when the session claim is empty', async () => {
    await db.exec('reset role')
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)
    await db.exec('set role authenticated')
    await expect(db.query('select public.delete_my_account()')).rejects.toThrow(/not signed in/)
  })
})

describe('the functions', () => {
  it('run with a fixed search path, so nothing can be swapped under them', async () => {
    await db.exec('reset role')
    const result = await db.query<{ proname: string; proconfig: string[] | null }>(
      `select proname, proconfig from pg_proc
       where proname in ('delete_my_cloud_data', 'delete_my_account') order by proname`
    )
    expect(result.rows.map((row) => row.proname)).toEqual([
      'delete_my_account',
      'delete_my_cloud_data'
    ])
    for (const row of result.rows) expect(row.proconfig).toContain('search_path=""')
  })
})
