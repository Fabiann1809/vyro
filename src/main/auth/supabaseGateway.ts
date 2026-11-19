import { createClient } from '@supabase/supabase-js'
import type { AuthFailure } from '@shared/account'
import type { AuthGateway, CurrentUser } from './authService'
import { AUTH_CALLBACK_URL } from './callback'
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
    data: { session: { user: { email?: string; id?: string } } | null }
    error: AuthErrorLike | null
  }>
  signInWithPassword: (credentials: { email: string; password: string }) => Promise<Outcome>
  signUp: (credentials: { email: string; password: string }) => Promise<{
    data: { session: { user: { email?: string; id?: string } } | null }
    error: AuthErrorLike | null
  }>
  verifyOtp: (params: {
    email: string
    token: string
    type: 'signup' | 'recovery'
  }) => Promise<Outcome>
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthErrorLike | null }>
  updateUser: (attributes: { password: string }) => Promise<{ error: AuthErrorLike | null }>
  signInWithOAuth: (params: {
    provider: 'google'
    options: { redirectTo: string; skipBrowserRedirect: boolean }
  }) => Promise<{ data: { url: string | null }; error: AuthErrorLike | null }>
  exchangeCodeForSession: (code: string) => Promise<{
    data: { session: { user: { email?: string; id?: string } } | null }
    error: AuthErrorLike | null
  }>
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
    // A wrong or old email code, or a return link that was used already or did not start here.
    case 'otp_expired':
    case 'flow_state_not_found':
    case 'flow_state_expired':
    case 'bad_code_verifier':
    case 'bad_oauth_callback':
    case 'bad_oauth_state':
      return 'invalid-code'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate-limited'
  }
  // A return link that this app did not start (no secret to match), or that Google refused.
  if (
    error.name === 'AuthPKCECodeVerifierMissingError' ||
    error.name === 'AuthPKCEGrantCodeExchangeError'
  ) {
    return 'invalid-code'
  }
  if (error.status === 429) return 'rate-limited'
  if (error.name === 'AuthRetryableFetchError') return 'network'
  return 'unknown'
}

function emailOf(user: UserLike): { email: string } | { error: AuthFailure } {
  return user?.email ? { email: user.email } : { error: 'unknown' }
}

// `storedUser` reads the session kept on disk without asking the server. It is used when the server
// cannot be reached, so that a person who signed in before can still practise offline.
//
// Without a connection the client keeps retrying for about half a minute before it gives up, and
// the app must not wait that long to open: after `patienceMs` the stored session is used.
export function createGateway(
  auth: SupabaseAuth,
  storedUser: () => CurrentUser | null = () => null,
  patienceMs = 3000
): AuthGateway {
  const fromServer = async (): Promise<CurrentUser | null> => {
    const { data, error } = await auth.getSession()
    const user = data.session?.user
    if (user?.email && user.id) return { email: user.email, id: user.id }
    return error && failureKind(error) === 'network' ? storedUser() : null
  }
  return {
    currentUser: async () => {
      const stored = storedUser()
      if (!stored) return fromServer()
      let timer: ReturnType<typeof setTimeout> | undefined
      const patience = new Promise<CurrentUser>((done) => {
        timer = setTimeout(() => done(stored), patienceMs)
      })
      try {
        return await Promise.race([fromServer(), patience])
      } finally {
        clearTimeout(timer)
      }
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
    startGoogleSignIn: async () => {
      const { data, error } = await auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: AUTH_CALLBACK_URL, skipBrowserRedirect: true }
      })
      if (error) return { error: failureKind(error) }
      return data.url ? { url: data.url } : { error: 'unknown' }
    },
    completeSignIn: async (code) => {
      const { data, error } = await auth.exchangeCodeForSession(code)
      if (error) return { error: failureKind(error) }
      return emailOf(data.session?.user ?? null)
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
  // Supabase keeps the session under a key made from the project name.
  const sessionKey = `sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`
  return createGateway(client.auth, () => readStoredUser(storage.getItem(sessionKey)))
}

// Who a stored session (a JSON text) belongs to, or null when there is none or it cannot be read.
export function readStoredUser(raw: string | null): CurrentUser | null {
  if (!raw) return null
  try {
    const user = (JSON.parse(raw) as { user?: { email?: unknown; id?: unknown } }).user
    return typeof user?.email === 'string' && user.email && typeof user.id === 'string' && user.id
      ? { email: user.email, id: user.id }
      : null
  } catch {
    return null
  }
}
