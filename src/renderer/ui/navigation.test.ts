import { beforeEach, describe, expect, it } from 'vitest'
import { isImmersive, nextScreen, useNavigation } from './navigation'

describe('navigation', () => {
  beforeEach(() => useNavigation.setState({ screen: 'home' }))

  it('starts on the home screen', () => {
    expect(useNavigation.getState().screen).toBe('home')
  })

  it('goes to the requested screen', () => {
    useNavigation.getState().go('progress')

    expect(useNavigation.getState().screen).toBe('progress')
  })

  it('hides the navigation only while calibrating and training', () => {
    expect(isImmersive('calibration')).toBe(true)
    expect(isImmersive('training')).toBe(true)
    expect(isImmersive('home')).toBe(false)
    expect(isImmersive('summary')).toBe(false)
    expect(isImmersive('progress')).toBe(false)
    expect(isImmersive('settings')).toBe(false)
  })

  it('follows the session flow and comes back home', () => {
    expect(nextScreen('home')).toBe('calibration')
    expect(nextScreen('calibration')).toBe('training')
    expect(nextScreen('training')).toBe('summary')
    expect(nextScreen('summary')).toBe('home')
    expect(nextScreen('settings')).toBeNull()
  })
})
