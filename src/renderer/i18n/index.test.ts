import { describe, expect, it } from 'vitest'
import { t } from './index'

describe('t', () => {
  it('returns the Spanish text for a key', () => {
    expect(t('camera.retry')).toBe('Reintentar')
  })

  it('fills named parameters', () => {
    expect(t('camera.fallbackName', { n: 2 })).toBe('Cámara 2')
  })
})
