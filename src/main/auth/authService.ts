import { z } from 'zod'
import {
  requestResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  verifyCodeSchema,
  type AccountStatus,
  type AuthFailure,
  type AuthResult
} from '@shared/account'

type Failed = { error: AuthFailure }
// Whoever is signed in after the call, or null when the call worked but nobody is signed in yet.
type Signed = { email: string } | null

// What the account code needs from the sign-in server, so tests can use a fake one.
export interface AuthGateway {
  // The person whose session is stored (renewed when it expired), or null.
  currentUser: () => Promise<{ email: string } | null>
  signInWithPassword: (email: string, password: string) => Promise<{ email: string } | Failed>
  // Signed in at once only when the project does not ask to confirm the email.
  signUp: (email: string, password: string) => Promise<Signed | Failed>
  // Confirms the email with the code that came in the message and signs the person in.
  verifyEmailCode: (email: string, code: string) => Promise<{ email: string } | Failed>
  requestPasswordReset: (email: string) => Promise<null | Failed>
  // Checks the code, sets the new password and signs the person in.
  resetPassword: (
    email: string,
    code: string,
    password: string
  ) => Promise<{ email: string } | Failed>
  signOut: () => Promise<void>
}

const SIGNED_OUT: AccountStatus = { state: 'signed-out' }

// The account in the main process. A null gateway means this build has no Supabase settings.
export class AuthService {
  constructor(private readonly gateway: AuthGateway | null) {}

  async status(): Promise<AccountStatus> {
    if (!this.gateway) return { state: 'unconfigured' }
    try {
      const user = await this.gateway.currentUser()
      return user ? { state: 'signed-in', email: user.email } : SIGNED_OUT
    } catch {
      return SIGNED_OUT
    }
  }

  signIn(input: unknown): Promise<AuthResult> {
    return this.run(signInSchema, input, (gateway, data) =>
      gateway.signInWithPassword(data.email, data.password)
    )
  }

  // The same answer whether or not the address already has an account, so it cannot be probed.
  signUp(input: unknown): Promise<AuthResult> {
    return this.run(signUpSchema, input, (gateway, data) =>
      gateway.signUp(data.email, data.password)
    )
  }

  verifyEmailCode(input: unknown): Promise<AuthResult> {
    return this.run(verifyCodeSchema, input, (gateway, data) =>
      gateway.verifyEmailCode(data.email, data.code)
    )
  }

  // Also the same answer for any address: whether it exists is not told.
  requestPasswordReset(input: unknown): Promise<AuthResult> {
    return this.run(requestResetSchema, input, (gateway, data) =>
      gateway.requestPasswordReset(data.email)
    )
  }

  resetPassword(input: unknown): Promise<AuthResult> {
    return this.run(resetPasswordSchema, input, (gateway, data) =>
      gateway.resetPassword(data.email, data.code, data.password)
    )
  }

  async signOut(): Promise<AccountStatus> {
    if (!this.gateway) return { state: 'unconfigured' }
    try {
      await this.gateway.signOut()
    } catch {
      // The stored session is dropped on this computer even if the server could not be told.
    }
    return SIGNED_OUT
  }

  // Validates the input, calls the server and turns the outcome into a result for the page.
  private async run<T>(
    schema: z.ZodType<T>,
    input: unknown,
    call: (gateway: AuthGateway, data: T) => Promise<Signed | Failed>
  ): Promise<AuthResult> {
    if (!this.gateway) return { ok: false, error: 'unconfigured' }
    const parsed = schema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'invalid-input' }
    try {
      const result = await call(this.gateway, parsed.data)
      if (result && 'error' in result) return { ok: false, error: result.error }
      return { ok: true, status: result ? { state: 'signed-in', email: result.email } : SIGNED_OUT }
    } catch {
      // Nothing from the failure is kept: it could carry the address or a token.
      return { ok: false, error: 'unknown' }
    }
  }
}
