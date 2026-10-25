import { useEffect, useState } from 'react'
import { markOpeningPlayed, OPENING_FADE_MS, OPENING_MS, shouldPlayOpening } from '../brandOpening'
import { useReducedMotion } from '../useReducedMotion'

// The mark of the brand drawing itself over the page, once, when the app opens. It never takes a
// click (the app is usable under it) and screen readers skip it.
export function BrandOpening(): React.JSX.Element | null {
  const reduceMotion = useReducedMotion()
  const [playing, setPlaying] = useState(() => shouldPlayOpening(reduceMotion))
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!playing) return
    markOpeningPlayed()
    const fade = setTimeout(() => setLeaving(true), OPENING_MS)
    const done = setTimeout(() => setPlaying(false), OPENING_MS + OPENING_FADE_MS)
    return () => {
      clearTimeout(fade)
      clearTimeout(done)
    }
  }, [playing])

  if (!playing) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-100 flex flex-col items-center justify-center gap-5 bg-bg transition-opacity"
      style={{ opacity: leaving ? 0 : 1, transitionDuration: `${OPENING_FADE_MS}ms` }}
    >
      <svg
        viewBox="0 0 40 40"
        className="size-28 drop-shadow-[0_10px_30px_oklch(0.65_0.18_40/0.6)]"
      >
        <defs>
          <linearGradient id="vy-opening" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFD1A0" />
            <stop offset="0.5" stopColor="#F27A3E" />
            <stop offset="1" stopColor="#A8326A" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="38" height="38" rx="13" fill="url(#vy-opening)" />
        <circle cx="20" cy="20" r="10" fill="none" stroke="#2A0F1A" strokeWidth="2.6" />
        <path
          d="M5.5 20h6.5l2.2-4.5 3.6 10 3.4-12 3 8.5 1.6-2h8.7"
          fill="none"
          stroke="#FFF6EE"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="60"
          strokeDashoffset="60"
          style={{ animation: 'vy-draw 1.2s 150ms cubic-bezier(0.3, 0.7, 0.2, 1) forwards' }}
        />
      </svg>
      <span
        className="font-display text-3xl font-extrabold tracking-[0.2em]"
        style={{ animation: 'vy-up 600ms 700ms both' }}
      >
        VYRO
      </span>
    </div>
  )
}
