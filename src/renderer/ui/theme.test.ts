import { describe, expect, it } from 'vitest'
import { nextPreference, resolveTheme, useTheme } from './theme'

describe('theme', () => {
  it('is dark by default', () => {
    expect(useTheme.getState().preference).toBe('dark')
  })

  it('uses the chosen theme whatever the system prefers', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('follows the system when asked to', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('cycles through every preference', () => {
    expect(nextPreference('dark')).toBe('light')
    expect(nextPreference('light')).toBe('system')
    expect(nextPreference('system')).toBe('dark')
  })

  it('stores the preference', () => {
    useTheme.getState().setPreference('light')

    expect(useTheme.getState().preference).toBe('light')
  })
})
