import { describe, expect, it, vi } from 'vitest'
import { AuthService, type AuthGateway } from './authService'

const SECRET = 'tok_secret_123'
const CODE = '123456'

// A small stand-in for the server: accounts that must confirm their email, and codes that work once.
function fakeServer(overrides: Partial<AuthGateway> = {}): AuthGateway {
  const accounts = new Map<string, { password: string; confirmed: boolean }>()
  let signedIn: { email: string } | null = null
  return {
    currentUser: async () => signedIn,
    signInWithPassword: async (email, password) => {
      const account = accounts.get(email)
      if (!account || account.password !== password) return { error: 'invalid-credentials' }
      if (!account.confirmed) return { error: 'email-not-confirmed' }
      signedIn = { email }
      return signedIn
    },
    signUp: async (email, password) => {
      // An address that already exists looks like a new one: its account is left as it was.
      if (!accounts.has(email)) accounts.set(email, { password, confirmed: false })
      return null
    },
    verifyEmailCode: async (email, code) => {
      const account = accounts.get(email)
      if (!account || code !== CODE) return { error: 'invalid-code' }
      account.confirmed = true
      signedIn = { email }
      return signedIn
    },
    requestPasswordReset: async () => null,
    resetPassword: async (email, code, password) => {
      const account = accounts.get(email)
      if (!account || code !== CODE) return { error: 'invalid-code' }
      account.password = password
      signedIn = { email }
      return signedIn
    },
    signOut: async () => void (signedIn = null),
    ...overrides
  }
}

const ANA = { email: '  Ana@Mail.com ', password: 'correct-pass' }

describe('AuthService without settings', () => {
  it('says the build is unconfigured', async () => {
    const auth = new AuthService(null)
    expect(await auth.status()).toEqual({ state: 'unconfigured' })
    expect(await auth.signOut()).toEqual({ state: 'unconfigured' })
    for (const result of [
      await auth.signIn(ANA),
      await auth.signUp(ANA),
      await auth.verifyEmailCode({ email: 'a@b.co', code: CODE }),
      await auth.requestPasswordReset({ email: 'a@b.co' }),
      await auth.resetPassword({ ...ANA, code: CODE })
    ]) {
      expect(result).toEqual({ ok: false, error: 'unconfigured' })
    }
  })
})

describe('AuthService sign in and out', () => {
  it('signs in, restores the session and signs out', async () => {
    const gateway = fakeServer()
    const auth = new AuthService(gateway)
    await auth.signUp(ANA)
    await auth.verifyEmailCode({ email: ANA.email, code: CODE })
    await auth.signOut()
    expect(await auth.status()).toEqual({ state: 'signed-out' })

    const result = await auth.signIn(ANA)
    expect(result).toEqual({ ok: true, status: { state: 'signed-in', email: 'ana@mail.com' } })

    // A new service over the same gateway stands for restarting the app with a stored session.
    expect(await new AuthService(gateway).status()).toEqual({
      state: 'signed-in',
      email: 'ana@mail.com'
    })
    expect(await auth.signOut()).toEqual({ state: 'signed-out' })
  })

  it('reports wrong credentials as a kind, not as text', async () => {
    const auth = new AuthService(fakeServer())
    expect(await auth.signIn({ email: 'ana@mail.com', password: 'nope' })).toEqual({
      ok: false,
      error: 'invalid-credentials'
    })
  })
})

describe('AuthService sign up', () => {
  it('asks to confirm the email before the first sign in', async () => {
    const auth = new AuthService(fakeServer())
    expect(await auth.signUp(ANA)).toEqual({ ok: true, status: { state: 'signed-out' } })
    expect(await auth.signIn(ANA)).toEqual({ ok: false, error: 'email-not-confirmed' })

    const verified = await auth.verifyEmailCode({ email: ANA.email, code: ` ${CODE} ` })
    expect(verified).toEqual({ ok: true, status: { state: 'signed-in', email: 'ana@mail.com' } })
  })

  it('answers the same for an address that already has an account', async () => {
    const auth = new AuthService(fakeServer())
    const first = await auth.signUp(ANA)
    await auth.verifyEmailCode({ email: ANA.email, code: CODE })
    await auth.signOut()
    const again = await auth.signUp({ email: ANA.email, password: 'other-password' })
    expect(again).toEqual(first)
    // The old password still works: signing up again did not touch the account.
    expect(await auth.signIn(ANA)).toMatchObject({ ok: true })
  })

  it('signs in at once when the project does not ask to confirm', async () => {
    const auth = new AuthService(fakeServer({ signUp: async (email) => ({ email }) }))
    expect(await auth.signUp(ANA)).toEqual({
      ok: true,
      status: { state: 'signed-in', email: 'ana@mail.com' }
    })
  })

  it('refuses a short or too long password without calling the server', async () => {
    const signUp = vi.fn()
    const auth = new AuthService(fakeServer({ signUp }))
    for (const password of ['short', 'a'.repeat(73), 'é'.repeat(37)]) {
      expect(await auth.signUp({ email: 'ana@mail.com', password })).toEqual({
        ok: false,
        error: 'invalid-input'
      })
    }
    expect(signUp).not.toHaveBeenCalled()
  })

  it('refuses a wrong code', async () => {
    const auth = new AuthService(fakeServer())
    await auth.signUp(ANA)
    expect(await auth.verifyEmailCode({ email: ANA.email, code: '000000' })).toEqual({
      ok: false,
      error: 'invalid-code'
    })
    expect(await auth.verifyEmailCode({ email: ANA.email, code: 'abc' })).toEqual({
      ok: false,
      error: 'invalid-input'
    })
  })
})

describe('AuthService password reset', () => {
  it('answers the same whether or not the address has an account', async () => {
    const auth = new AuthService(fakeServer())
    await auth.signUp(ANA)
    const known = await auth.requestPasswordReset({ email: ANA.email })
    const unknown = await auth.requestPasswordReset({ email: 'nadie@mail.com' })
    expect(known).toEqual(unknown)
    expect(known).toEqual({ ok: true, status: { state: 'signed-out' } })
  })

  it('sets a new password with the code from the email', async () => {
    const auth = new AuthService(fakeServer())
    await auth.signUp(ANA)
    await auth.verifyEmailCode({ email: ANA.email, code: CODE })
    await auth.signOut()

    const reset = await auth.resetPassword({
      email: ANA.email,
      code: CODE,
      password: 'brand-new-pass'
    })
    expect(reset).toMatchObject({ ok: true })
    await auth.signOut()
    expect(await auth.signIn(ANA)).toEqual({ ok: false, error: 'invalid-credentials' })
    expect(await auth.signIn({ email: ANA.email, password: 'brand-new-pass' })).toMatchObject({
      ok: true
    })
  })

  it('refuses a wrong code and a weak password', async () => {
    const auth = new AuthService(fakeServer())
    expect(
      await auth.resetPassword({
        email: 'ana@mail.com',
        code: '000000',
        password: 'brand-new-pass'
      })
    ).toEqual({ ok: false, error: 'invalid-code' })
    expect(
      await auth.resetPassword({ email: 'ana@mail.com', code: CODE, password: 'short' })
    ).toEqual({ ok: false, error: 'invalid-input' })
  })
})

describe('AuthService failures', () => {
  it('refuses malformed input without calling the server', async () => {
    const signInWithPassword = vi.fn()
    const auth = new AuthService(fakeServer({ signInWithPassword }))
    for (const input of [null, {}, { email: 'not-an-email', password: 'x' }, { email: 'a@b.co' }]) {
      expect(await auth.signIn(input)).toEqual({ ok: false, error: 'invalid-input' })
    }
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('never lets the text of a failure out', async () => {
    const boom = async (): Promise<never> => {
      throw new Error(`boom ${SECRET}`)
    }
    const auth = new AuthService(
      fakeServer({
        signInWithPassword: boom,
        signUp: boom,
        verifyEmailCode: boom,
        requestPasswordReset: boom,
        resetPassword: boom,
        currentUser: boom,
        signOut: boom
      })
    )
    const results = [
      await auth.signIn(ANA),
      await auth.signUp(ANA),
      await auth.verifyEmailCode({ email: ANA.email, code: CODE }),
      await auth.requestPasswordReset({ email: ANA.email }),
      await auth.resetPassword({ ...ANA, code: CODE }),
      await auth.status(),
      await auth.signOut()
    ]
    expect(JSON.stringify(results)).not.toContain(SECRET)
    expect(results.slice(0, 5)).toEqual(Array(5).fill({ ok: false, error: 'unknown' }))
    expect(results.slice(5)).toEqual([{ state: 'signed-out' }, { state: 'signed-out' }])
  })
})
