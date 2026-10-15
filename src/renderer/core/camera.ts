export interface CameraDevice {
  deviceId: string
  label: string
}

type DeviceLister = Pick<MediaDevices, 'enumerateDevices'>
type StreamOpener = Pick<MediaDevices, 'getUserMedia'>

// Labels are empty until the user grants camera permission once.
export async function listVideoInputs(devices: DeviceLister): Promise<CameraDevice[]> {
  const all = await devices.enumerateDevices()
  return all
    .filter((device) => device.kind === 'videoinput')
    .map(({ deviceId, label }) => ({ deviceId, label }))
}

// Video only: the app never asks for the microphone.
export function buildCameraConstraints(deviceId?: string): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    }
  }
}

export function openCamera(devices: StreamOpener, deviceId?: string): Promise<MediaStream> {
  return devices.getUserMedia(buildCameraConstraints(deviceId))
}

export function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop())
}

export type CameraErrorKind = 'permission-denied' | 'no-device' | 'in-use' | 'unknown'

export function classifyCameraError(error: unknown): CameraErrorKind {
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : ''

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'permission-denied'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'no-device'
    case 'NotReadableError':
    case 'AbortError':
      return 'in-use'
    default:
      return 'unknown'
  }
}
