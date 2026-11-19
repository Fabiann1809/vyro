import type { SupabaseClient } from '@supabase/supabase-js'
import { SyncError, type AccountCloud, type RemoteStore, type SyncFailure } from './remote'

interface Answer {
  error: { code?: string } | null
  status: number
}

// Only the kind of failure is kept: what the server says could carry data and is never shown.
export function failureOf(answer: Answer): SyncFailure {
  if (answer.status === 401 || answer.status === 403) return 'auth'
  // No status means the request never got an answer (no connection, a timeout).
  if (answer.status === 0 || (!answer.error?.code && answer.status < 200)) return 'network'
  return 'server'
}

function check(answer: Answer): void {
  if (answer.error) throw new SyncError(failureOf(answer))
}

// The cloud tables of the account, through the same client that holds the session: every request
// goes out as the signed-in person, and Row Level Security shows them only their own rows.
export function createSupabaseRemote(client: SupabaseClient): RemoteStore {
  return {
    upsert: async (table, rows) => {
      // A created skill is identified by the account and its own text id.
      const onConflict = table === 'custom_skills' ? 'user_id,id' : 'id'
      check(await client.from(table).upsert(rows, { onConflict }))
    },

    changedSince: async (table, since, limit) => {
      const answer = await client
        .from(table)
        .select('*')
        .gte('updated_at', since)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit)
      check(answer)
      return answer.data ?? []
    },

    remove: async (table, ids, at) => {
      // The row stays, marked, so that the other computers learn about the delete.
      check(await client.from(table).update({ deleted_at: at, updated_at: at }).in('id', ids))
    },

    // A function of the database that only ever touches the rows of the one who calls it.
    eraseAll: async () => check(await client.rpc('delete_my_cloud_data'))
  }
}

export function createSupabaseAccountCloud(client: SupabaseClient): AccountCloud {
  return {
    deleteAccount: async () => check(await client.rpc('delete_my_account'))
  }
}
