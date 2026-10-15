import { describe, expect, it } from 'vitest'
import { APP_NAME } from '@shared/app'

describe('app constants', () => {
  it('exposes the app name through the shared alias', () => {
    expect(APP_NAME).toBe('VYRO')
  })
})
