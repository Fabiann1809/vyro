import { z } from 'zod'

// What the page may know about the account: who is signed in, never a token (D21).
export type AccountStatus =
  // This build has no Supabase address or key, so nobody can sign in.
  { state: 'unconfigured' } | { state: 'signed-out' } | { state: 'signed-in'; email: string }

// Fixed kinds of failure: the text a server sends back never reaches the page or a log.
export type AuthFailure =
  'invalid-credentials' | 'invalid-input' | 'network' | 'unconfigured' | 'unknown'

export type AuthResult = { ok: true; status: AccountStatus } | { ok: false; error: AuthFailure }

// Signing in only needs something typed; the rules for a new password belong to signing up.
export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(256)
})

export type SignInInput = z.infer<typeof signInSchema>
