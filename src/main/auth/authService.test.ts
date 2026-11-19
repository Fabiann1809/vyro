import { describe, expect, it, vi } from 'vitest'
import { AuthService, type AuthGateway } from './authService'

const SECRET = 'tok_secret_123'

function fakeGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  let user: { email: string } | null = null
  return {
    currentUser: async () => user,
    signInWithPassword: async (email, password) => {
      if (password !== 'correct-pass') return { error: 'invalid-credentials' }
      user = { email }
      return { email }
    },
    signOut: async () => void (user = null),
    ...overrides
  }
}

describe('AuthService', () => {
  it('says the build is unconfigured when there is no gateway', async () => {
    const auth = new AuthService(null)
    expect(await auth.status()).toEqual({ state: 'unconfigured' })
    expect(await auth.signIn({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: false,
      error: 'unconfigured'
    })
    expect(await auth.signOut()).toEqual({ state: 'unconfigured' })
  })

  it('signs in, restores the session and signs out', async () => {
    const gateway = fakeGateway()
    const auth = new AuthService(gateway)
    expect(await auth.status()).toEqual({ state: 'signed-out' })

    const result = await auth.signIn({ email: '  Ana@Mail.com ', password: 'correct-pass' })
    expect(result).toEqual({ ok: true, status: { state: 'signed-in', email: 'ana@mail.com' } })

    // A new service over the same gateway stands for restarting the app with a stored session.
    expect(await new AuthService(gateway).status()).toEqual({
      state: 'signed-in',
      email: 'ana@mail.com'
    })

    expect(await auth.signOut()).toEqual({ state: 'signed-out' })
    expect(await auth.status()).toEqual({ state: 'signed-out' })
  })

  it('reports wrong credentials as a kind, not as text', async () => {
    const auth = new AuthService(fakeGateway())
    expect(await auth.signIn({ email: 'ana@mail.com', password: 'nope' })).toEqual({
      ok: false,
      error: 'invalid-credentials'
    })
  })

  it('refuses malformed input without calling the server', async () => {
    const signInWithPassword = vi.fn()
    const auth = new AuthService(fakeGateway({ signInWithPassword }))
    for (const input of [null, {}, { email: 'not-an-email', password: 'x' }, { email: 'a@b.co' }]) {
      expect(await auth.signIn(input)).toEqual({ ok: false, error: 'invalid-input' })
    }
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('never lets the text of a failure out', async () => {
    const auth = new AuthService(
      fakeGateway({
        signInWithPassword: async () => {
          throw new Error(`boom ${SECRET}`)
        },
        currentUser: async () => {
          throw new Error(`boom ${SECRET}`)
        },
        signOut: async () => {
          throw new Error(`boom ${SECRET}`)
        }
      })
    )
    const results = [
      await auth.signIn({ email: 'ana@mail.com', password: 'correct-pass' }),
      await auth.status(),
      await auth.signOut()
    ]
    expect(JSON.stringify(results)).not.toContain(SECRET)
    expect(results[0]).toEqual({ ok: false, error: 'unknown' })
    expect(results[1]).toEqual({ state: 'signed-out' })
    expect(results[2]).toEqual({ state: 'signed-out' })
  })
})
