import { describe, expect, it } from 'vitest'
import { t } from './index'

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
