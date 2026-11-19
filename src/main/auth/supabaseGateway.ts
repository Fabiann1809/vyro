import { createClient } from '@supabase/supabase-js'
import type { AuthFailure } from '@shared/account'
import type { AuthGateway } from './authService'
import type { AuthConfig } from './config'
import type { AuthStorage } from './sessionStorage'

interface AuthErrorLike {
  name?: string
  code?: string
  status?: number
}

type UserLike = { email?: string } | null
type Outcome = { data: { user: UserLike }; error: AuthErrorLike | null }

// The part of Supabase's auth client that is used, so the mapping below can be tested.
export interface SupabaseAuth {
  getSession: () => Promise<{
    data: { session: { user: { email?: string } } | null }
    error: AuthErrorLike | null
  }>
  signInWithPassword: (credentials: { email: string; password: string }) => Promise<Outcome>
  signUp: (credentials: { email: string; password: string }) => Promise<{
    data: { session: { user: { email?: string } } | null }
    error: AuthErrorLike | null
  }>
  verifyOtp: (params: {
    email: string
    token: string
    type: 'signup' | 'recovery'
  }) => Promise<Outcome>
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthErrorLike | null }>
  updateUser: (attributes: { password: string }) => Promise<{ error: AuthErrorLike | null }>
  signOut: (options: { scope: 'local' }) => Promise<{ error: AuthErrorLike | null }>
}

// Only the kind of failure is kept: the message of the server is not shown or logged.
export function failureKind(error: AuthErrorLike): AuthFailure {
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalid-credentials'
    case 'email_not_confirmed':
      return 'email-not-confirmed'
    case 'weak_password':
    case 'same_password':
      return 'weak-password'
    case 'otp_expired':
      return 'invalid-code'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate-limited'
  }
  if (error.status === 429) return 'rate-limited'
  if (error.name === 'AuthRetryableFetchError') return 'network'
  return 'unknown'
}

function emailOf(user: UserLike): { email: string } | { error: AuthFailure } {
  return user?.email ? { email: user.email } : { error: 'unknown' }
}

export function createGateway(auth: SupabaseAuth): AuthGateway {
  return {
    currentUser: async () => {
      const { data } = await auth.getSession()
      const email = data.session?.user.email
      return email ? { email } : null
    },
    signInWithPassword: async (email, password) => {
      const { data, error } = await auth.signInWithPassword({ email, password })
      return error ? { error: failureKind(error) } : emailOf(data.user)
    },
    signUp: async (email, password) => {
      const { data, error } = await auth.signUp({ email, password })
      // An address that already has an account looks like any other sign-up: nothing is told.
      if (error) return error.code === 'user_already_exists' ? null : { error: failureKind(error) }
      const signedIn = data.session?.user.email
      return signedIn ? { email: signedIn } : null
    },
    verifyEmailCode: async (email, code) => {
      const { data, error } = await auth.verifyOtp({ email, token: code, type: 'signup' })
      return error ? { error: failureKind(error) } : emailOf(data.user)
    },
    requestPasswordReset: async (email) => {
      const { error } = await auth.resetPasswordForEmail(email)
      return error ? { error: failureKind(error) } : null
    },
    resetPassword: async (email, code, password) => {
      const verified = await auth.verifyOtp({ email, token: code, type: 'recovery' })
      if (verified.error) return { error: failureKind(verified.error) }
      const { error } = await auth.updateUser({ password })
      if (error) {
        // The code opened a session; do not leave the person signed in with the old password.
        await auth.signOut({ scope: 'local' })
        return { error: failureKind(error) }
      }
      return emailOf(verified.data.user)
    },
    signOut: async () => {
      // `local` forgets the session on this computer, whether or not the server can be reached.
      await auth.signOut({ scope: 'local' })
    }
  }
}

// The Supabase client lives only in the main process: the page never gets a token (D21).
export function createSupabaseGateway(config: AuthConfig, storage: AuthStorage): AuthGateway {
  const client = createClient(config.url, config.publishableKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      // There is no page address to read a sign-in from: the return of Google comes by `vyro://` (T25.4).
      detectSessionInUrl: false,
      flowType: 'pkce'
    }
  })
  return createGateway(client.auth)
}
