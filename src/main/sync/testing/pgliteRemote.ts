import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { SyncError, type RemoteStore } from '../remote'
import type { RemoteRow, SyncTable } from '../tables'

// A stand-in for the cloud made of a real Postgres in memory with the real schema and the real Row
// Level Security (supabase/migrations). It is used by the tests of the sync: two computers and one
// account are two local databases and one `Cloud`. Not part of the app.

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

const MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations')

// What a call of the sync sent, as the cloud received it.
export interface Received {
  table: SyncTable
  operation: 'upsert' | 'remove' | 'read' | 'erase'
  rows: RemoteRow[]
}

export class Cloud {
  private constructor(private readonly db: PGlite) {}

  static async create(users: readonly string[]): Promise<Cloud> {
    const db = new PGlite()
    await db.exec(SUPABASE_STUB)
    for (const user of users) await db.exec(`insert into auth.users (id) values ('${user}')`)
    for (const file of readdirSync(MIGRATIONS).sort()) {
      await db.exec(readFileSync(resolve(MIGRATIONS, file), 'utf8'))
    }
    return new Cloud(db)
  }

  // Empties every table, as a new test needs.
  async reset(): Promise<void> {
    await this.db.exec('reset role')
    await this.db.exec(
      'truncate public.sessions, public.learning_paths, public.custom_skills restart identity cascade'
    )
  }

  // The rows of a table as the account sees them.
  async rows(userId: string, table: SyncTable): Promise<RemoteRow[]> {
    await this.actAs(userId)
    const result = await this.db.query<RemoteRow>(
      `select * from public.${table} order by updated_at, 1`
    )
    return result.rows.map(plain)
  }

  async actAs(userId: string): Promise<void> {
    await this.db.exec('reset role')
    await this.db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`)
    await this.db.exec('set role authenticated')
  }

  // The cloud as one signed-in person sees it. Everything that is sent is recorded in `log`.
  storeFor(userId: string, log: Received[] = []): RemoteStore {
    const isText = (table: SyncTable): boolean => table === 'custom_skills'
    return {
      upsert: async (table, rows) => {
        log.push({ table, operation: 'upsert', rows: structuredClone(rows) })
        await this.actAs(userId)
        for (const row of rows) {
          const columns = Object.keys(row)
          const values = columns.map((column) => row[column])
          const names = columns.join(', ')
          const marks = columns.map((_, index) => `$${index + 1}`).join(', ')
          const conflict = isText(table) ? 'user_id, id' : 'id'
          const update = columns
            .filter((column) => column !== 'id')
            .map((column) => `${column} = excluded.${column}`)
            .join(', ')
          await this.db.query(
            `insert into public.${table} (${names}) values (${marks})
             on conflict (${conflict}) do update set ${update}`,
            values
          )
        }
      },
      changedSince: async (table, since, limit) => {
        await this.actAs(userId)
        const result = await this.db.query<RemoteRow>(
          `select * from public.${table} where updated_at >= $1 order by updated_at, id limit $2`,
          [since, limit]
        )
        const rows = result.rows.map(plain)
        log.push({ table, operation: 'read', rows: [] })
        return rows
      },
      remove: async (table, ids, at) => {
        log.push({ table, operation: 'remove', rows: ids.map((id) => ({ id })) })
        await this.actAs(userId)
        await this.db.query(
          `update public.${table} set deleted_at = $2, updated_at = $2
           where id = any($1::${isText(table) ? 'text' : 'uuid'}[])`,
          [ids, at]
        )
      },
      eraseAll: async () => {
        log.push({ table: 'sessions', operation: 'erase', rows: [] })
        await this.actAs(userId)
        await this.db.query('select public.delete_my_cloud_data()')
      }
    }
  }
}

// Postgres gives big numbers back as BigInt; the real service gives plain numbers.
function plain(row: RemoteRow): RemoteRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === 'bigint' ? Number(value) : value
    ])
  )
}

// A store that fails like a computer with no connection, from the call number `after` on.
export function offlineAfter(store: RemoteStore, after: number): RemoteStore {
  let calls = 0
  const gate = async (): Promise<void> => {
    calls += 1
    if (calls > after) throw new SyncError('network')
  }
  return {
    upsert: async (table, rows) => {
      await gate()
      return store.upsert(table, rows)
    },
    changedSince: async (table, since, limit) => {
      await gate()
      return store.changedSince(table, since, limit)
    },
    remove: async (table, ids, at) => {
      await gate()
      return store.remove(table, ids, at)
    },
    eraseAll: async () => {
      await gate()
      return store.eraseAll()
    }
  }
}
