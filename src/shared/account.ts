import { z } from 'zod'

// What the page may know about the account: who is signed in, never a token (D21).
export type AccountStatus =
  // This build has no Supabase address or key, so nobody can sign in.
  { state: 'unconfigured' } | { state: 'signed-out' } | { state: 'signed-in'; email: string }

// Fixed kinds of failure: the text a server sends back never reaches the page or a log.
export type AuthFailure =
  | 'invalid-credentials'
  | 'invalid-input'
  | 'weak-password'
  | 'email-not-confirmed'
  | 'invalid-code'
  | 'rate-limited'
  | 'network'
  | 'unconfigured'
  | 'unknown'

export type AuthResult = { ok: true; status: AccountStatus } | { ok: false; error: AuthFailure }

const email = z.string().trim().toLowerCase().pipe(z.email().max(254))

// The server hashes only the first 72 bytes of a password, so a longer one is refused.
const newPassword = z
  .string()
  .min(8)
  .refine((value) => new TextEncoder().encode(value).length <= 72)

// The code that the email carries (6 digits by default, up to 10 if the project changes it).
const emailCode = z
  .string()
  .trim()
  .regex(/^\d{6,10}$/)

// Signing in only needs something typed; the rules for a new password belong to signing up.
export const signInSchema = z.object({ email, password: z.string().min(1).max(256) })
export const signUpSchema = z.object({ email, password: newPassword })
export const verifyCodeSchema = z.object({ email, code: emailCode })
export const requestResetSchema = z.object({ email })
export const resetPasswordSchema = z.object({ email, code: emailCode, password: newPassword })

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>
export type RequestResetInput = z.infer<typeof requestResetSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
