import { useEffect, useState } from 'react'
import { useReducedMotion } from '../useReducedMotion'

const DURATION_MS = 1200

// A number that counts up from 0 to its target, slowing down as it gets there (like a score filling
// a ring). With less motion asked for it is the target from the start.
export function useCountUp(target: number): number {
  const reduceMotion = useReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (reduceMotion) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - start) / DURATION_MS)
      setValue(Math.round(target * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, reduceMotion])

  return reduceMotion ? target : value
}
