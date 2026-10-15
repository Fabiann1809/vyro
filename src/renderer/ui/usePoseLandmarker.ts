import { useEffect, useState } from 'react'
import type { PoseDelegate } from '@renderer/core/delegate'
import { loadPoseLandmarker, type LoadedPose } from '@renderer/core/pose'

export type PoseStatus = 'loading' | 'ready' | 'error'

export interface PoseModelState {
  status: PoseStatus
  delegate: PoseDelegate | undefined
  pose: LoadedPose | null
}

export function usePoseLandmarker(): PoseModelState {
  const [state, setState] = useState<PoseModelState>({
    status: 'loading',
    delegate: undefined,
    pose: null
  })

  useEffect(() => {
    let cancelled = false
    let loaded: LoadedPose | null = null

    loadPoseLandmarker()
      .then((pose) => {
        if (cancelled) return pose.landmarker.close()
        loaded = pose
        setState({ status: 'ready', delegate: pose.delegate, pose })
      })
      .catch((error: unknown) => {
        console.error('Pose model failed to load', error)
        if (!cancelled) setState({ status: 'error', delegate: undefined, pose: null })
      })

    return () => {
      cancelled = true
      loaded?.landmarker.close()
    }
  }, [])

  return state
}
