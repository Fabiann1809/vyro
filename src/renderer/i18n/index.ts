import es from './es.json'

export type MessageKey = keyof typeof es

// Spanish only for now; the language setting arrives with the English translation.
const LANGUAGE = 'es'

// Picks the current language out of a text that comes in both, such as a skill name.
export const localize = (text: { es: string; en: string }): string => text[LANGUAGE]

// Minimal lookup until i18next replaces it (same keys, same JSON files).
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = es[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match))
}
