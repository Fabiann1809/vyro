import es from './es.json'

export type MessageKey = keyof typeof es

// Minimal lookup until i18next replaces it (same keys, same JSON files).
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = es[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match))
}
