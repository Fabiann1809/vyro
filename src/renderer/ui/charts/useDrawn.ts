import { useEffect, useState } from 'react'

// False when a chart appears and true a moment later, so that what it draws can move into place
// instead of being there from the start. With less motion asked for, the styles skip the movement.
export function useDrawn(): boolean {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return drawn
}
