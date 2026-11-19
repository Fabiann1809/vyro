import { createClient } from '@supabase/supabase-js'
import type { AuthFailure } from '@shared/account'
import type { AuthGateway } from './authService'
import type { AuthConfig } from './config'
import type { AuthStorage } from './sessionStorage'

interface AuthErrorLike {
  name?: string
  code?: string
}

// The part of Supabase's auth client that is used, so the mapping below can be tested.
export interface SupabaseAuth {
  getSession: () => Promise<{
    data: { session: { user: { email?: string } } | null }
    error: AuthErrorLike | null
  }>
  signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
    data: { user: { email?: string } | null }
    error: AuthErrorLike | null
  }>
  signOut: (options: { scope: 'local' }) => Promise<{ error: AuthErrorLike | null }>
}

// Only the kind of failure is kept: the message of the server is not shown or logged.
export function failureKind(error: AuthErrorLike): AuthFailure {
  if (error.code === 'invalid_credentials') return 'invalid-credentials'
  if (error.name === 'AuthRetryableFetchError') return 'network'
  return 'unknown'
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
      if (error) return { error: failureKind(error) }
      return data.user?.email ? { email: data.user.email } : { error: 'unknown' }
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
