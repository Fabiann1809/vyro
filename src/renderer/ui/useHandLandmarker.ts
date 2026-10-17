import { useEffect, useState } from 'react'
import { loadHandLandmarker, type LoadedHands } from '@renderer/core/hands'

export type HandsStatus = 'off' | 'loading' | 'ready' | 'error'

// Loads the hand model only while `enabled`: a skill that does not use hands pays nothing for it.
export function useHandLandmarker(enabled: boolean): {
  status: HandsStatus
  hands: LoadedHands | null
} {
  const [loaded, setLoaded] = useState<LoadedHands | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let current: LoadedHands | null = null

    loadHandLandmarker()
      .then((hands) => {
        if (cancelled) return hands.landmarker.close()
        current = hands
        setLoaded(hands)
      })
      .catch((error: unknown) => {
        console.error('Hand model failed to load', error)
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      current?.landmarker.close()
      setLoaded(null)
      setFailed(false)
    }
  }, [enabled])

  const status: HandsStatus = !enabled ? 'off' : failed ? 'error' : loaded ? 'ready' : 'loading'
  return { status, hands: loaded }
}
