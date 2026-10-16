import i18next from 'i18next'
import es from './es.json'

// Plural forms are stored as "key_one" and "key_other"; the code asks for "key" plus a count.
type WithoutPluralSuffix<K extends string> = K extends `${infer Base}_${'one' | 'other'}` ? Base : K

export type MessageKey = WithoutPluralSuffix<keyof typeof es>

// Spanish only for now; the language setting arrives with the English translation.
const LANGUAGE = 'es'

// Keys are flat strings that contain dots, and parameters are written {name}.
void i18next.init({
  lng: LANGUAGE,
  fallbackLng: LANGUAGE,
  resources: { es: { translation: es } },
  keySeparator: false,
  nsSeparator: false,
  interpolation: { prefix: '{', suffix: '}', escapeValue: false },
  initAsync: false
})

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return i18next.t(key, params)
}

// Picks the current language out of a text that comes in both, such as a skill name.
export const localize = (text: { es: string; en: string }): string => text[LANGUAGE]
