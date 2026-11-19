// Where the browser sends the person back to the app after signing in with Google (D21).
export const AUTH_CALLBACK_URL = 'vyro://auth/callback'

// What a return link can mean: a one-time code to trade for a session, or a failed attempt.
export type AuthCallback = { kind: 'code'; code: string } | { kind: 'failed' }

// The codes are short random strings; anything else in that place is not one.
const CODE_PATTERN = /^[A-Za-z0-9._~-]{8,512}$/

// The link that opened the app, if any, among the command-line arguments (Windows and Linux).
export function findCallbackUrl(argv: readonly string[]): string | null {
  return argv.find((arg) => arg.startsWith('vyro://')) ?? null
}

// Reads a link `vyro://auth/callback?code=...`. Null when it is not the sign-in link, so that no
// other `vyro://` address can make the app do anything.
export function parseAuthCallback(link: string): AuthCallback | null {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  if (url.protocol !== 'vyro:' || url.hostname !== 'auth' || url.pathname !== '/callback') {
    return null
  }
  if (url.searchParams.has('error') || url.searchParams.has('error_code')) return { kind: 'failed' }
  const code = url.searchParams.get('code')
  return code && CODE_PATTERN.test(code) ? { kind: 'code', code } : { kind: 'failed' }
}
