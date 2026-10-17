import { create } from 'zustand'
import { useSettings } from './settingsStore'

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

// idle      nothing is happening
// start     the layer sits over the card it came from
// full      the layer has grown to cover the whole window
// leaving   the new screen is there and the layer is fading away
export type ExpandPhase = 'idle' | 'start' | 'full' | 'leaving'

interface ExpandState {
  phase: ExpandPhase
  from: Rect | null
}

export const useExpand = create<ExpandState>(() => ({ phase: 'idle', from: null }))

// How long the card takes to fill the window, and how long the layer lingers while it fades.
export const EXPAND_MS = 460
export const FADE_MS = 300

const wantsLessMotion = (): boolean =>
  useSettings.getState().reduceMotion ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The card a pressed button is in, the one that grows: it is marked with data-expand.
export const cardOf = (button: Element): Element | null => button.closest('[data-expand]')

// Makes the card the person pressed grow until it fills the window, and only then runs the action
// (which opens the next screen): it feels like going into the card, not like changing page. Without a
// card to start from, or with less motion asked for, the action runs at once.
export function startWithExpand(source: Element | null, action: () => void): void {
  if (!source || wantsLessMotion() || useExpand.getState().phase !== 'idle') {
    action()
    return
  }

  const box = source.getBoundingClientRect()
  useExpand.setState({
    phase: 'start',
    from: { top: box.top, left: box.left, width: box.width, height: box.height }
  })
  // Two frames, so that the browser has drawn the layer small before it starts to grow.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (useExpand.getState().phase === 'start') useExpand.setState({ phase: 'full' })
    })
  )
  setTimeout(() => {
    action()
    useExpand.setState({ phase: 'leaving' })
    setTimeout(() => useExpand.setState({ phase: 'idle', from: null }), FADE_MS)
  }, EXPAND_MS + 20)
}
