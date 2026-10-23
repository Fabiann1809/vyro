import {
  AudioCapture,
  type AudioFeatures,
  type CaptureDeps,
  type FeatureExtractor
} from '@renderer/core/audio/capture'
import type { SoundListener } from '@renderer/core/audio/instrumentListener'
import type { VyroApi } from '@shared/ipc'

type MicrophoneApi = { microphone: Pick<VyroApi['microphone'], 'setOpen' | 'requestAccess'> }

export interface Listening {
  close: () => void
}

// Starts listening. The main process is told first, because it refuses the microphone to a page
// that has not said a skill that listens is open; it is told again when listening stops. The
// operating system's own refusal (macOS) is reported as a denial.
export async function listenToMicrophone(
  api: MicrophoneApi,
  onFeatures: (features: AudioFeatures) => void,
  options: {
    deviceId?: string
    deps?: CaptureDeps
    extract?: FeatureExtractor
    listener?: SoundListener
  } = {}
): Promise<Listening> {
  await api.microphone.setOpen(true)
  try {
    const access = await api.microphone.requestAccess()
    if (access === 'denied' || access === 'restricted') {
      throw Object.assign(new Error('The system denied the microphone.'), {
        name: 'NotAllowedError'
      })
    }
    const capture = await AudioCapture.open(onFeatures, options)
    return {
      close: () => {
        capture.close()
        void api.microphone.setOpen(false)
      }
    }
  } catch (error) {
    await api.microphone.setOpen(false)
    throw error
  }
}
