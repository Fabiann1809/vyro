import { PoseLandmarker } from '@mediapipe/tasks-vision'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import modelAssetPath from '@renderer/assets/models/pose_landmarker_lite.task?url'
import { createWithDelegateFallback, type PoseDelegate } from './delegate'

export interface LoadedPose {
  landmarker: PoseLandmarker
  delegate: PoseDelegate
}

// Everything (wasm runtime and model) is bundled with the app: no network access is needed.
export async function loadPoseLandmarker(): Promise<LoadedPose> {
  const { value, delegate } = await createWithDelegateFallback((delegate) =>
    PoseLandmarker.createFromOptions(
      { wasmLoaderPath, wasmBinaryPath },
      {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1
      }
    )
  )
  return { landmarker: value, delegate }
}
