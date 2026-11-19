import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { SyncError } from './remote'
import { createSupabaseRemote, failureOf } from './supabaseRemote'

interface Call {
  table: string
  steps: Array<[string, unknown[]]>
}

type Answer = { error: { code?: string } | null; status: number; data?: unknown[] | null }

// Records what is asked of a table, in order, and answers what it is told to.
function fakeClient(answer: Answer = { error: null, status: 200, data: [] }): {
  client: SupabaseClient
  calls: Call[]
} {
  const calls: Call[] = []
  const client = {
    from: (table: string) => {
      const call: Call = { table, steps: [] }
      calls.push(call)
      const chain: Record<string, unknown> = {}
      for (const step of ['upsert', 'select', 'update', 'gte', 'order', 'limit', 'in']) {
        chain[step] = (...args: unknown[]) => {
          call.steps.push([step, args])
          return chain
        }
      }
      chain['then'] = (resolve: (value: Answer) => unknown) => resolve(answer)
      return chain
    }
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('createSupabaseRemote', () => {
  it('sends new and changed rows as an upsert on the id', async () => {
    const { client, calls } = fakeClient()
    await createSupabaseRemote(client).upsert('sessions', [{ id: 'a', updated_at: 1 }])
    expect(calls[0]).toEqual({
      table: 'sessions',
      steps: [['upsert', [[{ id: 'a', updated_at: 1 }], { onConflict: 'id' }]]]
    })
  })

  it('upserts a created skill on the account and its own id', async () => {
    const { client, calls } = fakeClient()
    await createSupabaseRemote(client).upsert('custom_skills', [{ id: 'custom_a' }])
    expect(calls[0]?.steps[0]).toEqual([
      'upsert',
      [[{ id: 'custom_a' }], { onConflict: 'user_id,id' }]
    ])
  })

  it('asks for what changed since a date, oldest first', async () => {
    const { client, calls } = fakeClient({ error: null, status: 200, data: [{ id: 'a' }] })
    const rows = await createSupabaseRemote(client).changedSince('reps', 500, 100)
    expect(rows).toEqual([{ id: 'a' }])
    expect(calls[0]?.steps).toEqual([
      ['select', ['*']],
      ['gte', ['updated_at', 500]],
      ['order', ['updated_at', { ascending: true }]],
      ['order', ['id', { ascending: true }]],
      ['limit', [100]]
    ])
  })

  it('marks rows as deleted instead of erasing them', async () => {
    const { client, calls } = fakeClient()
    await createSupabaseRemote(client).remove('path_steps', ['a', 'b'], 9000)
    expect(calls[0]?.steps).toEqual([
      ['update', [{ deleted_at: 9000, updated_at: 9000 }]],
      ['in', ['id', ['a', 'b']]]
    ])
  })

  it('turns every failure into a kind, never keeping what the server said', async () => {
    const down = fakeClient({ error: { code: '' }, status: 0 })
    await expect(createSupabaseRemote(down.client).upsert('sessions', [])).rejects.toMatchObject({
      kind: 'network'
    })
    const denied = fakeClient({ error: { code: '42501' }, status: 403 })
    await expect(
      createSupabaseRemote(denied.client).changedSince('sessions', 0, 1)
    ).rejects.toBeInstanceOf(SyncError)
  })
})

describe('failureOf', () => {
  it('tells a refused session, a missing connection and a broken server apart', () => {
    expect(failureOf({ error: { code: 'PGRST301' }, status: 401 })).toBe('auth')
    expect(failureOf({ error: { code: '42501' }, status: 403 })).toBe('auth')
    expect(failureOf({ error: { code: '' }, status: 0 })).toBe('network')
    expect(failureOf({ error: { code: 'XX000' }, status: 500 })).toBe('server')
    expect(failureOf({ error: { code: '23505' }, status: 409 })).toBe('server')
  })
})
