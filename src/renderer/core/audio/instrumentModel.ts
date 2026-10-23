import { AudioClassifier } from '@mediapipe/tasks-audio'
import wasmBinaryPath from '@mediapipe/tasks-audio/audio_wasm_internal.wasm?url'
import wasmLoaderPath from '@mediapipe/tasks-audio/audio_wasm_internal.js?url'
import modelAssetPath from '@renderer/assets/models/yamnet.tflite?url'
import type { HeardClass } from './instrument'
import { InstrumentListener } from './instrumentListener'

let loading: Promise<AudioClassifier> | null = null

// Loaded once and kept, since opening the model takes a moment. A failed load is tried again.
function loadClassifier(): Promise<AudioClassifier> {
  loading ??= AudioClassifier.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    { baseOptions: { modelAssetPath }, maxResults: 20 }
  ).catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

// Like the pose model: the runtime and the model ship with the app, so no network is needed. Each
// listener has its own memory of the sound; they share the model.
export async function loadInstrumentListener(): Promise<InstrumentListener> {
  const classifier = await loadClassifier()

  return new InstrumentListener((samples, sampleRate): HeardClass[] => {
    const windows = classifier.classify(samples, sampleRate)
    const last = windows[windows.length - 1]?.classifications[0]?.categories ?? []
    return last.map((category) => ({ name: category.categoryName, score: category.score }))
  })
}
