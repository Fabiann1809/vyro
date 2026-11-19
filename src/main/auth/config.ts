import { mayOpenInBrowser } from './browser'

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

// The address of the fake account service that the tests of the app give it, or undefined. A packaged
// app never takes it, so nobody can point an installed VYRO at another server by setting a variable.
export function testServerUrl(
  isPackaged: boolean,
  env: Record<string, string | undefined>
): string | undefined {
  return isPackaged ? undefined : env['VYRO_E2E_SUPABASE_URL']
}

export interface AuthConfig {
  url: string
  // The publishable key (formerly "anon"): public by design, protected by Row Level Security.
  // The service key must never be used here.
  publishableKey: string
}

// Reads the address and key set when the app is built. Null when they are missing or odd, so the
// app can say so instead of failing on the first request. A plain address on this computer is
// accepted only when `allowLoopbackHttp` says the app is under test.
export function readAuthConfig(
  env: Record<string, unknown>,
  options: { allowLoopbackHttp?: boolean } = {}
): AuthConfig | null {
  const url = text(env['MAIN_VITE_SUPABASE_URL'])
  const publishableKey = text(env['MAIN_VITE_SUPABASE_PUBLISHABLE_KEY'])
  if (!url || !publishableKey) return null
  // A service key is a secret and must never ship in the app.
  if (publishableKey.startsWith('sb_secret_')) return null
  // The same rule as for the addresses opened in the browser: secure, or this computer under test.
  if (!mayOpenInBrowser(url, options.allowLoopbackHttp)) return null
  return { url: url.replace(/\/+$/, ''), publishableKey }
}
