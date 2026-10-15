export type CameraAccessStatus = 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown'

// Deep link to the operating system's camera privacy page. Linux has none.
export function cameraSettingsUrl(platform: string): string | undefined {
  if (platform === 'darwin')
    return 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera'
  if (platform === 'win32') return 'ms-settings:privacy-webcam'
  return undefined
}
