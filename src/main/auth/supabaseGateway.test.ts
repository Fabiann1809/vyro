import { describe, expect, it, vi } from 'vitest'
import type { CurrentUser } from './authService'
import { createGateway, failureKind, readStoredUser, type SupabaseAuth } from './supabaseGateway'

const OK = { data: { user: { email: 'ana@mail.com' } }, error: null }

function fakeAuth(overrides: Partial<SupabaseAuth> = {}): SupabaseAuth {
  return {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => OK,
    signUp: async () => ({ data: { session: null }, error: null }),
    verifyOtp: async () => OK,
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
    signInWithOAuth: async () => ({
      data: { url: 'https://accounts.example.com/start' },
      error: null
    }),
    exchangeCodeForSession: async () => ({
      data: { session: { user: { email: 'ana@gmail.com' } } },
      error: null
    }),
    signOut: async () => ({ error: null }),
    ...overrides
  }
}

describe('failureKind', () => {
  it('maps the errors of Supabase to fixed kinds', () => {
    expect(failureKind({ code: 'invalid_credentials' })).toBe('invalid-credentials')
    expect(failureKind({ code: 'email_not_confirmed' })).toBe('email-not-confirmed')
    expect(failureKind({ code: 'weak_password' })).toBe('weak-password')
    expect(failureKind({ code: 'same_password' })).toBe('weak-password')
    expect(failureKind({ code: 'otp_expired' })).toBe('invalid-code')
    expect(failureKind({ code: 'flow_state_not_found' })).toBe('invalid-code')
    expect(failureKind({ code: 'bad_code_verifier' })).toBe('invalid-code')
    expect(failureKind({ name: 'AuthPKCECodeVerifierMissingError' })).toBe('invalid-code')
    expect(failureKind({ name: 'AuthPKCEGrantCodeExchangeError' })).toBe('invalid-code')
    expect(failureKind({ code: 'over_email_send_rate_limit' })).toBe('rate-limited')
    expect(failureKind({ status: 429 })).toBe('rate-limited')
    expect(failureKind({ name: 'AuthRetryableFetchError' })).toBe('network')
    expect(failureKind({ name: 'AuthApiError', code: 'something_else' })).toBe('unknown')
  })
})

describe('createGateway', () => {
  it('returns the email of the stored session, or null', async () => {
    expect(await createGateway(fakeAuth()).currentUser()).toBeNull()

    const stored = createGateway(
      fakeAuth({
        getSession: async () => ({
          data: { session: { user: { email: 'ana@mail.com', id: 'u1' } } },
          error: null
        })
      })
    )
    expect(await stored.currentUser()).toEqual({ email: 'ana@mail.com', id: 'u1' })
  })

  it('uses the stored session when the server cannot be reached', async () => {
    const offline = fakeAuth({
      getSession: async () => ({
        data: { session: null },
        error: { name: 'AuthRetryableFetchError' }
      })
    })
    const stored = (): CurrentUser => ({ email: 'ana@mail.com', id: 'u1' })
    expect(await createGateway(offline, stored).currentUser()).toEqual({
      email: 'ana@mail.com',
      id: 'u1'
    })
    expect(await createGateway(offline).currentUser()).toBeNull()
  })

  it('opens with the stored session when the server is slow to answer', async () => {
    const slow = fakeAuth({ getSession: () => new Promise(() => {}) })
    const stored = (): CurrentUser => ({ email: 'ana@mail.com', id: 'u1' })
    expect(await createGateway(slow, stored, 20).currentUser()).toEqual({
      email: 'ana@mail.com',
      id: 'u1'
    })
  })

  it('prefers what the server says when it answers in time', async () => {
    const refused = fakeAuth({ getSession: async () => ({ data: { session: null }, error: null }) })
    const stored = (): CurrentUser => ({ email: 'ana@mail.com', id: 'u1' })
    expect(await createGateway(refused, stored, 1000).currentUser()).toBeNull()
  })

  it('does not trust the stored session when the server refused it', async () => {
    const refused = fakeAuth({
      getSession: async () => ({
        data: { session: null },
        error: { code: 'refresh_token_not_found' }
      })
    })
    const stored = (): CurrentUser => ({ email: 'ana@mail.com', id: 'u1' })
    expect(await createGateway(refused, stored).currentUser()).toBeNull()
  })

  it('returns a kind of failure when signing in fails', async () => {
    const gateway = createGateway(
      fakeAuth({
        signInWithPassword: async () => ({
          data: { user: null },
          error: { code: 'email_not_confirmed' }
        })
      })
    )
    expect(await gateway.signInWithPassword('ana@mail.com', 'x')).toEqual({
      error: 'email-not-confirmed'
    })
  })

  it('signs up: nobody is signed in until the email is confirmed', async () => {
    const gateway = createGateway(fakeAuth())
    expect(await gateway.signUp('ana@mail.com', 'long-enough-pass')).toBeNull()

    const instant = createGateway(
      fakeAuth({
        signUp: async () => ({
          data: { session: { user: { email: 'ana@mail.com' } } },
          error: null
        })
      })
    )
    expect(await instant.signUp('ana@mail.com', 'long-enough-pass')).toEqual({
      email: 'ana@mail.com'
    })
  })

  it('hides that an address already has an account', async () => {
    const gateway = createGateway(
      fakeAuth({
        signUp: async () => ({ data: { session: null }, error: { code: 'user_already_exists' } })
      })
    )
    expect(await gateway.signUp('ana@mail.com', 'long-enough-pass')).toBeNull()
  })

  it('verifies the email with a signup code', async () => {
    const verifyOtp = vi.fn(async () => OK)
    const gateway = createGateway(fakeAuth({ verifyOtp }))
    expect(await gateway.verifyEmailCode('ana@mail.com', '123456')).toEqual({
      email: 'ana@mail.com'
    })
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'ana@mail.com',
      token: '123456',
      type: 'signup'
    })
  })

  it('asks for a reset code', async () => {
    const resetPasswordForEmail = vi.fn(async () => ({ error: null }))
    const gateway = createGateway(fakeAuth({ resetPasswordForEmail }))
    expect(await gateway.requestPasswordReset('ana@mail.com')).toBeNull()
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@mail.com')
  })

  it('resets the password: checks the code, then sets the new one', async () => {
    const verifyOtp = vi.fn(async () => OK)
    const updateUser = vi.fn(async () => ({ error: null }))
    const gateway = createGateway(fakeAuth({ verifyOtp, updateUser }))
    expect(await gateway.resetPassword('ana@mail.com', '123456', 'brand-new-pass')).toEqual({
      email: 'ana@mail.com'
    })
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'ana@mail.com',
      token: '123456',
      type: 'recovery'
    })
    expect(updateUser).toHaveBeenCalledWith({ password: 'brand-new-pass' })
  })

  it('does not set a password when the code is wrong', async () => {
    const updateUser = vi.fn(async () => ({ error: null }))
    const gateway = createGateway(
      fakeAuth({
        verifyOtp: async () => ({ data: { user: null }, error: { code: 'otp_expired' } }),
        updateUser
      })
    )
    expect(await gateway.resetPassword('ana@mail.com', '000000', 'brand-new-pass')).toEqual({
      error: 'invalid-code'
    })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('signs out again when the new password is refused', async () => {
    const signOut = vi.fn(async () => ({ error: null }))
    const gateway = createGateway(
      fakeAuth({ updateUser: async () => ({ error: { code: 'weak_password' } }), signOut })
    )
    expect(await gateway.resetPassword('ana@mail.com', '123456', 'password1')).toEqual({
      error: 'weak-password'
    })
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('starts Google in the browser and comes back to the app by vyro://', async () => {
    const signInWithOAuth = vi.fn(async () => ({
      data: { url: 'https://accounts.example.com/start' },
      error: null
    }))
    const gateway = createGateway(fakeAuth({ signInWithOAuth }))
    expect(await gateway.startGoogleSignIn()).toEqual({ url: 'https://accounts.example.com/start' })
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'vyro://auth/callback', skipBrowserRedirect: true }
    })
  })

  it('fails when Google gives no address', async () => {
    const gateway = createGateway(
      fakeAuth({ signInWithOAuth: async () => ({ data: { url: null }, error: null }) })
    )
    expect(await gateway.startGoogleSignIn()).toEqual({ error: 'unknown' })
  })

  it('trades the code of the return link for a session', async () => {
    const exchangeCodeForSession = vi.fn(async () => ({
      data: { session: { user: { email: 'ana@gmail.com' } } },
      error: null
    }))
    const gateway = createGateway(fakeAuth({ exchangeCodeForSession }))
    expect(await gateway.completeSignIn('google-code-1234')).toEqual({ email: 'ana@gmail.com' })
    expect(exchangeCodeForSession).toHaveBeenCalledWith('google-code-1234')
  })

  it('reports a code that was used or expired', async () => {
    const gateway = createGateway(
      fakeAuth({
        exchangeCodeForSession: async () => ({
          data: { session: null },
          error: { code: 'flow_state_not_found' }
        })
      })
    )
    expect(await gateway.completeSignIn('google-code-1234')).toEqual({ error: 'invalid-code' })
  })

  it('signs out only on this computer, so it works without a connection', async () => {
    const signOut = vi.fn(async () => ({ error: null }))
    await createGateway(fakeAuth({ signOut })).signOut()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})

describe('readStoredUser', () => {
  it('reads the email of a stored session', () => {
    expect(readStoredUser(JSON.stringify({ user: { email: 'ana@mail.com', id: 'u1' } }))).toEqual({
      email: 'ana@mail.com',
      id: 'u1'
    })
  })

  it('is null when there is no session or it cannot be read', () => {
    for (const raw of [
      null,
      '',
      'not json',
      '{}',
      '{"user":{}}',
      '{"user":{"email":3}}',
      '{"user":{"email":"a@b.co"}}'
    ]) {
      expect(readStoredUser(raw)).toBeNull()
    }
  })
})
