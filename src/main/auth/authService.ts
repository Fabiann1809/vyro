import {
  signInSchema,
  type AccountStatus,
  type AuthFailure,
  type AuthResult
} from '@shared/account'

// What the account code needs from the sign-in server, so tests can use a fake one.
export interface AuthGateway {
  // The person whose session is stored (renewed when it expired), or null.
  currentUser: () => Promise<{ email: string } | null>
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ email: string } | { error: AuthFailure }>
  signOut: () => Promise<void>
}

// The account in the main process. A null gateway means this build has no Supabase settings.
export class AuthService {
  constructor(private readonly gateway: AuthGateway | null) {}

  async status(): Promise<AccountStatus> {
    if (!this.gateway) return { state: 'unconfigured' }
    try {
      const user = await this.gateway.currentUser()
      return user ? { state: 'signed-in', email: user.email } : { state: 'signed-out' }
    } catch {
      return { state: 'signed-out' }
    }
  }

  async signIn(input: unknown): Promise<AuthResult> {
    if (!this.gateway) return { ok: false, error: 'unconfigured' }
    const parsed = signInSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'invalid-input' }
    try {
      const result = await this.gateway.signInWithPassword(parsed.data.email, parsed.data.password)
      if ('error' in result) return { ok: false, error: result.error }
      return { ok: true, status: { state: 'signed-in', email: result.email } }
    } catch {
      // Nothing from the failure is kept: it could carry the address or a token.
      return { ok: false, error: 'unknown' }
    }
  }

  async signOut(): Promise<AccountStatus> {
    if (!this.gateway) return { state: 'unconfigured' }
    try {
      await this.gateway.signOut()
    } catch {
      // The stored session is dropped on this computer even if the server could not be told.
    }
    return { state: 'signed-out' }
  }
}
