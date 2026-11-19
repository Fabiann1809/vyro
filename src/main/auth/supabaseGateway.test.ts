import { describe, expect, it, vi } from 'vitest'
import { createGateway, failureKind, type SupabaseAuth } from './supabaseGateway'

const OK = { data: { user: { email: 'ana@mail.com' } }, error: null }

function fakeAuth(overrides: Partial<SupabaseAuth> = {}): SupabaseAuth {
  return {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => OK,
    signUp: async () => ({ data: { session: null }, error: null }),
    verifyOtp: async () => OK,
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
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

  it('signs out only on this computer, so it works without a connection', async () => {
    const signOut = vi.fn(async () => ({ error: null }))
    await createGateway(fakeAuth({ signOut })).signOut()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
