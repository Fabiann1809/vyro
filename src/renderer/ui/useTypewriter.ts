import { useEffect, useState } from 'react'

// How a reply of the coach appears: a few letters at a time, as if it were being written.
const TICK_MS = 20
const LETTERS_PER_TICK = 2

// The part of the text to show now. When it is not enabled the whole text is there from the start.
export function useTypewriter(text: string, enabled: boolean): string {
  const [count, setCount] = useState(enabled ? 0 : text.length)

  useEffect(() => {
    if (!enabled) return
    let shown = 0
    const timer = setInterval(() => {
      shown = Math.min(text.length, shown + LETTERS_PER_TICK)
      setCount(shown)
      if (shown >= text.length) clearInterval(timer)
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [text, enabled])

  return enabled ? text.slice(0, count) : text
}
