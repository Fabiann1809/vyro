import { afterEach, describe, expect, it } from 'vitest'
import en from './en.json'
import es from './es.json'
import { localize, setLanguage, t } from './index'

afterEach(() => setLanguage('es'))

describe('t', () => {
  it('returns the Spanish text for a key', () => {
    expect(t('camera.retry')).toBe('Reintentar')
  })

  it('fills named parameters', () => {
    expect(t('camera.fallbackName', { n: 2 })).toBe('Cámara 2')
  })

  it('uses the singular and the plural form of a text', () => {
    expect(t('summary.total', { count: 1 })).toBe('1 repetición')
    expect(t('summary.total', { count: 5 })).toBe('5 repeticiones')
  })

  it('keeps a text with dots in its key as one key', () => {
    expect(t('camera.error.noDevice.title')).toBe('No encontramos ninguna cámara')
  })
})

describe('language', () => {
  it('switches every text to English and back', () => {
    setLanguage('en')
    expect(t('camera.retry')).toBe('Try again')
    expect(t('summary.total', { count: 1 })).toBe('1 repetition')

    setLanguage('es')
    expect(t('camera.retry')).toBe('Reintentar')
  })

  it('translates the texts that come from a skill', () => {
    const name = { es: 'Sentadilla', en: 'Squat' }

    expect(localize(name)).toBe('Sentadilla')
    setLanguage('en')
    expect(localize(name)).toBe('Squat')
  })

  it('has the same keys in Spanish and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  })

  it('leaves no text empty in English', () => {
    expect(Object.values(en).filter((text) => text.trim() === '')).toEqual([])
  })

  it('uses the same parameters in both languages', () => {
    const parameters = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort()
    const esTexts = es as Record<string, string>

    for (const [key, text] of Object.entries(en)) {
      expect(parameters(text), key).toEqual(parameters(esTexts[key] ?? ''))
    }
  })
})
