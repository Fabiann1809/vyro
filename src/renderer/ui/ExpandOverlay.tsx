import { useExpand } from './expandTransition'

// The layer that grows out of a card (see startWithExpand). It never takes a click, and it is only
// decoration: the screen it leads to is already being drawn under it.
export function ExpandOverlay(): React.JSX.Element | null {
  const { phase, from } = useExpand()
  if (phase === 'idle' || !from) return null

  const full = phase !== 'start'
  return (
    <div
      aria-hidden="true"
      className="force-dark pointer-events-none fixed z-50 border border-line/8"
      style={{
        top: full ? 0 : from.top,
        left: full ? 0 : from.left,
        width: full ? '100vw' : from.width,
        height: full ? '100vh' : from.height,
        borderRadius: full ? 0 : 28,
        background: full ? '#07080b' : 'var(--card)',
        opacity: phase === 'leaving' ? 0 : 1,
        transition:
          phase === 'leaving' ? 'opacity 300ms ease-out' : 'all 460ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    />
  )
}
