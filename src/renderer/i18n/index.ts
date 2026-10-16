import i18next from 'i18next'
import en from './en.json'
import es from './es.json'

export type Language = 'es' | 'en'

// Plural forms are stored as "key_one" and "key_other"; the code asks for "key" plus a count.
type WithoutPluralSuffix<K extends string> = K extends `${infer Base}_${'one' | 'other'}` ? Base : K

// Spanish is the reference: the English file must have exactly the same keys.
export type MessageKey = WithoutPluralSuffix<keyof typeof es>

// Keys are flat strings that contain dots, and parameters are written {name}.
void i18next.init({
  lng: 'es',
  fallbackLng: 'es',
  resources: { es: { translation: es }, en: { translation: en } },
  keySeparator: false,
  nsSeparator: false,
  interpolation: { prefix: '{', suffix: '}', escapeValue: false },
  initAsync: false
})

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return i18next.t(key, params)
}

// Bundled texts need no loading, so the change is in effect as soon as this returns.
export function setLanguage(language: Language): void {
  void i18next.changeLanguage(language)
}

export const currentLanguage = (): Language => (i18next.language === 'en' ? 'en' : 'es')

// Picks the current language out of a text that comes in both, such as a skill name.
export const localize = (text: { es: string; en: string }): string => text[currentLanguage()]
