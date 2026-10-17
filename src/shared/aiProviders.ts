export type AiProviderId = 'claude' | 'groq' | 'gemini' | 'ollama' | 'custom'

export const AI_PROVIDER_IDS: readonly AiProviderId[] = [
  'claude',
  'groq',
  'gemini',
  'ollama',
  'custom'
]

export interface ProviderPreset {
  // Where the OpenAI-compatible API lives; null for Claude (it has its own SDK) and for "custom".
  baseUrl: string | null
  // The model for each kind of request; null when the user has to choose one.
  models: { fast: string | null; capable: string | null }
  // Ollama runs on the user's computer and ignores the key.
  requiresKey: boolean
}

// URLs and model names checked against each provider's documentation on 2026-10-16. Models
// change often: the user can always type another one in Settings.
export const AI_PROVIDERS: Record<AiProviderId, ProviderPreset> = {
  claude: { baseUrl: null, models: { fast: null, capable: null }, requiresKey: true },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    models: { fast: 'openai/gpt-oss-20b', capable: 'openai/gpt-oss-120b' },
    requiresKey: true
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: { fast: 'gemini-3.5-flash-lite', capable: 'gemini-3.8-flash' },
    requiresKey: true
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    // Whatever the user has pulled with `ollama pull`; this one is small and common.
    models: { fast: 'llama3.2', capable: 'llama3.2' },
    requiresKey: false
  },
  custom: { baseUrl: null, models: { fast: null, capable: null }, requiresKey: true }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

// A key must not travel in plain text over the network: HTTPS everywhere, and plain HTTP only to
// this same computer. Addresses with a user name or password in them are refused too.
export function isSafeAiBaseUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.username || url.password) return false
  if (url.protocol === 'https:') return true
  return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)
}
