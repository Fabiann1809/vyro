import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXPAND_MS, FADE_MS, startWithExpand, useExpand } from './expandTransition'
import { useSettings } from './settingsStore'

const card = {
  getBoundingClientRect: () => ({ top: 10, left: 20, width: 300, height: 120 })
} as unknown as Element

function stubSystem(prefersLessMotion: boolean): void {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: prefersLessMotion }) })
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    setTimeout(callback, 0)
    return 0
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  stubSystem(false)
  useSettings.setState({ reduceMotion: false })
  useExpand.setState({ phase: 'idle', from: null })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('startWithExpand', () => {
  it('runs the action at once when there is no card to grow from', () => {
    const action = vi.fn()

    startWithExpand(null, action)

    expect(action).toHaveBeenCalledTimes(1)
    expect(useExpand.getState().phase).toBe('idle')
  })

  it('runs the action at once when less motion is asked for in the settings', () => {
    useSettings.setState({ reduceMotion: true })
    const action = vi.fn()

    startWithExpand(card, action)

    expect(action).toHaveBeenCalledTimes(1)
    expect(useExpand.getState().phase).toBe('idle')
  })

  it('runs the action at once when the system asks for less motion', () => {
    stubSystem(true)
    const action = vi.fn()

    startWithExpand(card, action)

    expect(action).toHaveBeenCalledTimes(1)
    expect(useExpand.getState().phase).toBe('idle')
  })

  it('grows out of the card, runs the action once it covers the window, and fades away', () => {
    const action = vi.fn()

    startWithExpand(card, action)
    expect(useExpand.getState()).toMatchObject({
      phase: 'start',
      from: { top: 10, left: 20, width: 300, height: 120 }
    })

    vi.advanceTimersByTime(5)
    expect(useExpand.getState().phase).toBe('full')
    expect(action).not.toHaveBeenCalled()

    vi.advanceTimersByTime(EXPAND_MS + 20)
    expect(action).toHaveBeenCalledTimes(1)
    expect(useExpand.getState().phase).toBe('leaving')

    vi.advanceTimersByTime(FADE_MS)
    expect(useExpand.getState()).toMatchObject({ phase: 'idle', from: null })
  })

  it('does not start a second one while one is going on', () => {
    const first = vi.fn()
    const second = vi.fn()

    startWithExpand(card, first)
    startWithExpand(card, second)

    // The second press is not lost: it runs at once, as if there were nothing to grow from.
    expect(second).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(EXPAND_MS + FADE_MS + 50)
    expect(first).toHaveBeenCalledTimes(1)
  })
})
