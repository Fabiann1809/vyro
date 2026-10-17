import { beforeEach, describe, expect, it } from 'vitest'
import { isImmersive, NAV_SCREENS, navHome, returnTarget, useNavigation } from './navigation'

describe('navigation', () => {
  beforeEach(() => useNavigation.setState({ screen: 'home', previous: null }))

  it('starts on the home screen', () => {
    expect(useNavigation.getState().screen).toBe('home')
  })

  it('goes to the requested screen', () => {
    useNavigation.getState().go('dashboard')

    expect(useNavigation.getState().screen).toBe('dashboard')
  })

  it('hides the navigation only while calibrating and training', () => {
    expect(isImmersive('calibration')).toBe(true)
    expect(isImmersive('training')).toBe(true)
    expect(isImmersive('home')).toBe(false)
    expect(isImmersive('summary')).toBe(false)
    expect(isImmersive('dashboard')).toBe(false)
    expect(isImmersive('settings')).toBe(false)
  })

  it('lists the five destinations of the side bar', () => {
    expect(NAV_SCREENS).toEqual(['home', 'dashboard', 'path', 'library', 'settings'])
  })

  it('keeps the destination marked in the screens that hang from it', () => {
    expect(navHome('summary')).toBe('dashboard')
    expect(navHome('skillNew')).toBe('library')
    expect(navHome('path')).toBe('path')
  })

  it('remembers the screen the person came from', () => {
    useNavigation.getState().go('path')
    useNavigation.getState().go('calibration')

    expect(useNavigation.getState().previous).toBe('path')
  })

  it('returns to a main destination, and to the library from anywhere else', () => {
    expect(returnTarget('path')).toBe('path')
    expect(returnTarget('home')).toBe('home')
    expect(returnTarget('skillNew')).toBe('library')
    expect(returnTarget('summary')).toBe('library')
    expect(returnTarget('settings')).toBe('library')
    expect(returnTarget(null)).toBe('library')
  })
})
