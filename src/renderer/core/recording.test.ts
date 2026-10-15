import { describe, expect, it } from 'vitest'
import type { PoseFrame } from './detectionLoop'
import { POSE_LANDMARK_COUNT, type Landmark } from './landmarks'
import {
  LandmarkRecorder,
  landmarksOf,
  parseRecording,
  recordingFileName,
  serializeRecording
} from './recording'

const FRAME_SIZE = { width: 1280, height: 720 }
const FIXED_DATE = new Date('2026-10-15T21:30:45.123Z')

function pose(seed = 0): Landmark[] {
  return Array.from({ length: POSE_LANDMARK_COUNT }, (_, index) => ({
    x: 0.123456789 + index / 100 + seed,
    y: 0.5,
    z: -0.0123456,
    visibility: 0.98765
  }))
}

function frame(timestampMs: number, landmarks: Landmark[] | null = pose()): PoseFrame {
  return { timestampMs, latencyMs: 10, presentedFrames: 0, landmarks }
}

function recorder(label = 'squat-good'): LandmarkRecorder {
  return new LandmarkRecorder(FRAME_SIZE, label, () => FIXED_DATE)
}

describe('LandmarkRecorder', () => {
  it('starts empty', () => {
    expect(recorder().frameCount).toBe(0)
    expect(recorder().finish().frames).toEqual([])
  })

  it('records every frame it is given', () => {
    const rec = recorder()
    rec.add(frame(1000))
    rec.add(frame(1033))

    expect(rec.frameCount).toBe(2)
    expect(rec.finish().frames).toHaveLength(2)
  })

  it('times frames from the first one, not from the page load', () => {
    const rec = recorder()
    rec.add(frame(52_000))
    rec.add(frame(52_033.34))
    rec.add(frame(52_100))

    expect(rec.finish().frames.map((entry) => entry.t)).toEqual([0, 33.3, 100])
  })

  it('records a frame with nobody in view as null', () => {
    const rec = recorder()
    rec.add(frame(0, null))

    expect(rec.finish().frames[0]?.landmarks).toBeNull()
  })

  it('rounds the numbers to keep the file small', () => {
    const rec = recorder()
    rec.add(frame(0))

    const first = rec.finish().frames[0]?.landmarks?.[0]
    expect(first).toEqual([0.1235, 0.5, -0.0123, 0.988])
  })

  it('keeps 33 points in every frame', () => {
    const rec = recorder()
    rec.add(frame(0))

    expect(rec.finish().frames[0]?.landmarks).toHaveLength(33)
  })

  it('describes the recording', () => {
    const recording = recorder('curl-bad-elbow').finish()

    expect(recording).toMatchObject({
      version: 1,
      label: 'curl-bad-elbow',
      recordedAt: '2026-10-15T21:30:45.123Z',
      frameSize: { width: 1280, height: 720 }
    })
  })

  it('does not change a recording that was already finished', () => {
    const rec = recorder()
    rec.add(frame(0))
    const done = rec.finish()

    rec.add(frame(33))

    expect(done.frames).toHaveLength(1)
  })
})

describe('serializeRecording and parseRecording', () => {
  function sample(): ReturnType<LandmarkRecorder['finish']> {
    const rec = recorder()
    rec.add(frame(0))
    rec.add(frame(33, null))
    rec.add(frame(66))
    return rec.finish()
  }

  it('gives back what was recorded', () => {
    const parsed = parseRecording(serializeRecording(sample()))

    expect(parsed).toEqual({ ok: true, recording: sample() })
  })

  it('writes one frame per line', () => {
    const lines = serializeRecording(sample()).split('\n')

    expect(lines.filter((line) => line.trimStart().startsWith('{"t":'))).toHaveLength(3)
  })

  it('is valid JSON that ends with a newline', () => {
    const text = serializeRecording(sample())

    expect(() => JSON.parse(text)).not.toThrow()
    expect(text.endsWith('\n')).toBe(true)
  })

  it('stores nothing but numbers for the body, never an image', () => {
    const parsed = JSON.parse(serializeRecording(sample())) as {
      frames: Array<{ t: number; landmarks: number[][] | null }>
    }

    expect(Object.keys(parsed).sort()).toEqual([
      'frameSize',
      'frames',
      'label',
      'recordedAt',
      'version'
    ])
    for (const entry of parsed.frames) {
      expect(Object.keys(entry).sort()).toEqual(['landmarks', 't'])
      for (const point of entry.landmarks ?? []) {
        expect(point.every((value) => typeof value === 'number')).toBe(true)
      }
    }
  })

  it('can turn a recorded frame back into landmarks', () => {
    const parsed = parseRecording(serializeRecording(sample()))
    if (!parsed.ok) throw new Error(parsed.error)

    const [first, second] = parsed.recording.frames
    expect(landmarksOf(first!)?.[0]).toEqual({ x: 0.1235, y: 0.5, z: -0.0123, visibility: 0.988 })
    expect(landmarksOf(second!)).toBeNull()
  })

  it('accepts a recording without frames', () => {
    expect(parseRecording(serializeRecording(recorder().finish())).ok).toBe(true)
  })

  describe('rejects', () => {
    it('text that is not JSON', () => {
      expect(parseRecording('not json')).toEqual({ ok: false, error: 'the file is not valid JSON' })
    })

    it('a version it does not know', () => {
      const text = serializeRecording(sample()).replace('"version": 1', '"version": 2')

      expect(parseRecording(text).ok).toBe(false)
    })

    it('a frame with the wrong number of points', () => {
      const broken = { ...sample(), frames: [{ t: 0, landmarks: [[0, 0, 0, 1]] }] }

      const result = parseRecording(JSON.stringify(broken))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('frames.0.landmarks')
    })

    it('extra fields, so nothing unexpected such as an image can ride along', () => {
      const withImage = { ...sample(), screenshot: 'data:image/png;base64,AAAA' }

      expect(parseRecording(JSON.stringify(withImage)).ok).toBe(false)
    })

    it('a frame with extra fields', () => {
      const broken = { ...sample(), frames: [{ t: 0, landmarks: null, image: 'x' }] }

      expect(parseRecording(JSON.stringify(broken)).ok).toBe(false)
    })

    it('values that are not numbers', () => {
      const point = ['a', 0, 0, 1]
      const broken = {
        ...sample(),
        frames: [{ t: 0, landmarks: Array.from({ length: 33 }, () => point) }]
      }

      expect(parseRecording(JSON.stringify(broken)).ok).toBe(false)
    })

    it('a negative time', () => {
      const broken = { ...sample(), frames: [{ t: -1, landmarks: null }] }

      expect(parseRecording(JSON.stringify(broken)).ok).toBe(false)
    })

    it('a missing frame size', () => {
      // JSON.stringify leaves out undefined values, so the key is really missing.
      const broken = { ...sample(), frameSize: undefined }

      expect(parseRecording(JSON.stringify(broken)).ok).toBe(false)
    })
  })
})

describe('recordingFileName', () => {
  it('builds a safe name from the label and the time', () => {
    expect(recordingFileName('Squat Good', '2026-10-15T21:30:45.123Z')).toBe(
      'squat-good-2026-10-15T21-30-45-123.json'
    )
  })

  it('removes characters that could escape a folder', () => {
    const name = recordingFileName('../../etc/passwd', '2026-10-15T21:30:45.123Z')

    expect(name).not.toContain('/')
    expect(name).not.toContain('..')
    expect(name.endsWith('.json')).toBe(true)
  })

  it('falls back to a default when the label has no usable characters', () => {
    expect(recordingFileName('???', '2026-10-15T21:30:45.123Z')).toMatch(/^recording-/)
    expect(recordingFileName('', '2026-10-15T21:30:45.123Z')).toMatch(/^recording-/)
  })
})
