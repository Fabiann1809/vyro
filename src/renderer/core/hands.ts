import { HandLandmarker } from '@mediapipe/tasks-vision'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import modelAssetPath from '@renderer/assets/models/hand_landmarker.task?url'
import { createWithDelegateFallback, type PoseDelegate } from './delegate'

export interface LoadedHands {
  landmarker: HandLandmarker
  delegate: PoseDelegate
}

// Same as the pose model: the runtime and the model ship with the app, so no network is needed.
export async function loadHandLandmarker(): Promise<LoadedHands> {
  const { value, delegate } = await createWithDelegateFallback((delegate) =>
    HandLandmarker.createFromOptions(
      { wasmLoaderPath, wasmBinaryPath },
      {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numHands: 2
      }
    )
  )
  return { landmarker: value, delegate }
}
