import { describe, expect, it } from 'vitest'
import { evaluateFraming, type FramingInput, type FramingReport } from './framing'
import { POSE_LANDMARK_COUNT, type Landmark } from './landmarks'
import { JOINT_INDEX } from './side'

const FRAME = { width: 1280, height: 720 }

interface PersonOptions {
  // Vertical extent of the shoulder-to-ankle line, as fractions of the frame height.
  top?: number
  bottom?: number
  // Horizontal distance between the shoulders in pixels; null hides the far shoulder.
  shoulderGapPx?: number | null
}

// A person standing in profile on the left of the frame, seen from the left side.
function person({
  top = 0.2,
  bottom = 0.85,
  shoulderGapPx = null
}: PersonOptions = {}): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0
  }))
  const height = bottom - top
  const put = (name: keyof (typeof JOINT_INDEX)['left'], y: number, visibility = 0.98): void => {
    landmarks[JOINT_INDEX.left[name]] = { x: 0.5, y, z: 0, visibility }
  }
  put('shoulder', top)
  put('elbow', top + height * 0.25)
  put('wrist', top + height * 0.45)
  put('hip', top + height * 0.5)
  put('knee', top + height * 0.75)
  put('ankle', bottom)

  if (shoulderGapPx !== null) {
    landmarks[JOINT_INDEX.right.shoulder] = {
      x: 0.5 + shoulderGapPx / FRAME.width,
      y: top,
      z: 0,
      visibility: 0.95
    }
  }
  return landmarks
}

const framing = (overrides: Partial<FramingInput> = {}): FramingReport =>
  evaluateFraming({
    landmarks: person(),
    luminance: 120,
    frameSize: FRAME,
    camera: { view: 'side', fullBody: true },
    ...overrides
  })

describe('evaluateFraming', () => {
  it('accepts a whole body in profile at a good distance in good light', () => {
    expect(framing()).toEqual({
      fullBody: 'ok',
      profile: 'ok',
      distance: 'ok',
      lighting: 'ok',
      instruction: null
    })
  })

  it('waits for a person when nobody is in view', () => {
    const report = framing({ landmarks: null })

    expect(report).toMatchObject({ fullBody: 'pending', instruction: 'stepIntoView' })
  })

  it('asks for the whole body when the feet are cut off', () => {
    const landmarks = person()
    landmarks[JOINT_INDEX.left.ankle] = { x: 0.5, y: 1, z: 0, visibility: 0.2 }

    expect(framing({ landmarks })).toMatchObject({
      fullBody: 'fix',
      instruction: 'showFullBody'
    })
  })

  it('asks to step back when the body fills the whole frame', () => {
    expect(framing({ landmarks: person({ top: 0.03, bottom: 0.97 }) })).toMatchObject({
      distance: 'fix',
      instruction: 'moveBack'
    })
  })

  it('asks to come closer when the body is small', () => {
    expect(framing({ landmarks: person({ top: 0.4, bottom: 0.7 }) })).toMatchObject({
      distance: 'fix',
      instruction: 'moveCloser'
    })
  })

  it('asks to turn sideways when both shoulders are wide apart', () => {
    expect(framing({ landmarks: person({ shoulderGapPx: 150 }) })).toMatchObject({
      profile: 'fix',
      instruction: 'turnSideways'
    })
  })

  it('accepts overlapping shoulders as a profile', () => {
    expect(framing({ landmarks: person({ shoulderGapPx: 20 }) }).profile).toBe('ok')
  })

  it('does not ask for a profile when the exercise is seen from the front', () => {
    const report = framing({
      landmarks: person({ shoulderGapPx: 150 }),
      camera: { view: 'front', fullBody: true }
    })

    expect(report.profile).toBe('ok')
  })

  it('asks for more light first, whatever else is wrong', () => {
    const report = framing({ luminance: 20, landmarks: person({ shoulderGapPx: 150 }) })

    expect(report).toMatchObject({ lighting: 'fix', instruction: 'moreLight' })
  })

  it('asks for less light when the picture is washed out', () => {
    const report = framing({ luminance: 230, landmarks: person({ shoulderGapPx: 150 }) })

    expect(report).toMatchObject({ lighting: 'fix', instruction: 'lessLight' })
  })

  it('does not judge the light until it has been measured', () => {
    expect(framing({ luminance: null }).lighting).toBe('pending')
  })

  it('only needs the upper body when the exercise does not use the legs', () => {
    const landmarks = person({ top: 0.2, bottom: 0.85 })
    landmarks[JOINT_INDEX.left.ankle] = { x: 0.5, y: 1, z: 0, visibility: 0 }
    landmarks[JOINT_INDEX.left.knee] = { x: 0.5, y: 1, z: 0, visibility: 0 }

    expect(framing({ landmarks, camera: { view: 'side', fullBody: false } })).toMatchObject({
      fullBody: 'ok',
      instruction: null
    })
  })

  it('asks for the shoulders, the arm and the hip, not the feet, when the legs are not used', () => {
    const landmarks = person()
    landmarks[JOINT_INDEX.left.wrist] = { x: 0.5, y: 1, z: 0, visibility: 0.2 }

    expect(framing({ landmarks, camera: { view: 'side', fullBody: false } })).toMatchObject({
      fullBody: 'fix',
      instruction: 'showUpperBody'
    })
  })
})
