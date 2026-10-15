import { describe, expect, it } from 'vitest'
import { cameraSettingsUrl } from '@shared/camera'

describe('cameraSettingsUrl', () => {
  it('points to the camera privacy page on macOS and Windows', () => {
    expect(cameraSettingsUrl('darwin')).toContain('Privacy_Camera')
    expect(cameraSettingsUrl('win32')).toBe('ms-settings:privacy-webcam')
  })

  it('has no page on Linux', () => {
    expect(cameraSettingsUrl('linux')).toBeUndefined()
  })
})
