import { describe, expect, it, vi } from 'vitest'
import { createGateway, failureKind, type SupabaseAuth } from './supabaseGateway'

function fakeAuth(overrides: Partial<SupabaseAuth> = {}): SupabaseAuth {
  return {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: { user: { email: 'ana@mail.com' } }, error: null }),
    signOut: async () => ({ error: null }),
    ...overrides
  }
}

describe('failureKind', () => {
  it('maps the errors of Supabase to fixed kinds', () => {
    expect(failureKind({ code: 'invalid_credentials' })).toBe('invalid-credentials')
    expect(failureKind({ name: 'AuthRetryableFetchError' })).toBe('network')
    expect(failureKind({ name: 'AuthApiError', code: 'something_else' })).toBe('unknown')
  })
})

describe('createGateway', () => {
  it('returns the email of the stored session, or null', async () => {
    const none = createGateway(fakeAuth())
    expect(await none.currentUser()).toBeNull()

    const stored = createGateway(
      fakeAuth({
        getSession: async () => ({
          data: { session: { user: { email: 'ana@mail.com' } } },
          error: null
        })
      })
    )
    expect(await stored.currentUser()).toEqual({ email: 'ana@mail.com' })
  })

  it('returns a kind of failure when signing in fails', async () => {
    const gateway = createGateway(
      fakeAuth({
        signInWithPassword: async () => ({
          data: { user: null },
          error: { code: 'invalid_credentials' }
        })
      })
    )
    expect(await gateway.signInWithPassword('ana@mail.com', 'x')).toEqual({
      error: 'invalid-credentials'
    })
  })

  it('signs out only on this computer, so it works without a connection', async () => {
    const signOut = vi.fn(async () => ({ error: null }))
    await createGateway(fakeAuth({ signOut })).signOut()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
