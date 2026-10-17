import { useEffect, useState } from 'react'
import { loadObjectDetector, type LoadedObjects } from '@renderer/core/objects'

export type ObjectsStatus = 'off' | 'loading' | 'ready' | 'error'

// Loads the object model only while `enabled`: a skill that does not use an object pays nothing for it.
export function useObjectDetector(enabled: boolean): {
  status: ObjectsStatus
  objects: LoadedObjects | null
} {
  const [loaded, setLoaded] = useState<LoadedObjects | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let current: LoadedObjects | null = null

    loadObjectDetector()
      .then((objects) => {
        if (cancelled) return objects.detector.close()
        current = objects
        setLoaded(objects)
      })
      .catch((error: unknown) => {
        console.error('Object model failed to load', error)
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      current?.detector.close()
      setLoaded(null)
      setFailed(false)
    }
  }, [enabled])

  const status: ObjectsStatus = !enabled ? 'off' : failed ? 'error' : loaded ? 'ready' : 'loading'
  return { status, objects: loaded }
}
