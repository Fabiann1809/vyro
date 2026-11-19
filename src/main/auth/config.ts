function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

export interface AuthConfig {
  url: string
  // The publishable key (formerly "anon"): public by design, protected by Row Level Security.
  // The service key must never be used here.
  publishableKey: string
}

// Reads the address and key set when the app is built. Null when they are missing or odd, so the
// app can say so instead of failing on the first request.
export function readAuthConfig(env: Record<string, unknown>): AuthConfig | null {
  const url = text(env['MAIN_VITE_SUPABASE_URL'])
  const publishableKey = text(env['MAIN_VITE_SUPABASE_PUBLISHABLE_KEY'])
  if (!url || !publishableKey) return null
  // A service key is a secret and must never ship in the app.
  if (publishableKey.startsWith('sb_secret_')) return null
  try {
    if (new URL(url).protocol !== 'https:') return null
  } catch {
    return null
  }
  return { url: url.replace(/\/+$/, ''), publishableKey }
}
