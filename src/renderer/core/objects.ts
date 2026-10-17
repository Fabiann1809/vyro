import { ObjectDetector } from '@mediapipe/tasks-vision'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import modelAssetPath from '@renderer/assets/models/guitar_detector.tflite?url'
import { createWithDelegateFallback, type PoseDelegate } from './delegate'

export interface LoadedObjects {
  detector: ObjectDetector
  delegate: PoseDelegate
}

// Below this score a box is more likely a mistake than a guitar.
const MIN_SCORE = 0.4

// Same as the pose and hand models: the runtime and the model ship with the app, so no network is
// needed. The model only knows the guitar (docs/OBJECT_DATA.md).
export async function loadObjectDetector(): Promise<LoadedObjects> {
  const { value, delegate } = await createWithDelegateFallback((delegate) =>
    ObjectDetector.createFromOptions(
      { wasmLoaderPath, wasmBinaryPath },
      {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        scoreThreshold: MIN_SCORE,
        maxResults: 1
      }
    )
  )
  return { detector: value, delegate }
}
