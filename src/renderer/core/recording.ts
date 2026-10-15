import { z } from 'zod'
import type { PoseFrame } from './detectionLoop'
import { POSE_LANDMARK_COUNT, type Landmark } from './landmarks'

// A recording holds numbers only: the 33 body points of each frame, never any image.
// It is used to build test fixtures from real movements.
export const RECORDING_VERSION = 1

const number = z.number().finite()

// [x, y, z, visibility]
const recordedLandmark = z.tuple([number, number, number, number])

const recordedFrame = z
  .object({
    // Milliseconds since the first frame of the recording.
    t: z.number().finite().min(0),
    // null when nobody was in view.
    landmarks: z.array(recordedLandmark).length(POSE_LANDMARK_COUNT).nullable()
  })
  .strict()

export const recordingSchema = z
  .object({
    version: z.literal(RECORDING_VERSION),
    label: z.string().min(1),
    recordedAt: z.string().min(1),
    // Needed to turn the normalized coordinates back into pixels.
    frameSize: z
      .object({ width: z.number().int().positive(), height: z.number().int().positive() })
      .strict(),
    frames: z.array(recordedFrame)
  })
  .strict()

export type LandmarkRecording = z.infer<typeof recordingSchema>
export type RecordedFrame = LandmarkRecording['frames'][number]

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

// Four decimals are 0.13 px on a 1280 px wide frame: enough, and far smaller files.
function toRecorded(landmarks: readonly Landmark[]): RecordedFrame['landmarks'] {
  return landmarks.map((landmark) => [
    round(landmark.x, 4),
    round(landmark.y, 4),
    round(landmark.z, 4),
    round(landmark.visibility, 3)
  ])
}

export function landmarksOf(frame: RecordedFrame): Landmark[] | null {
  return frame.landmarks?.map(([x, y, z, visibility]) => ({ x, y, z, visibility })) ?? null
}

export class LandmarkRecorder {
  private readonly frames: RecordedFrame[] = []
  private firstTimestampMs: number | undefined

  constructor(
    private readonly frameSize: { width: number; height: number },
    private readonly label: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  get frameCount(): number {
    return this.frames.length
  }

  add(frame: PoseFrame): void {
    this.firstTimestampMs ??= frame.timestampMs

    this.frames.push({
      t: round(frame.timestampMs - this.firstTimestampMs, 1),
      landmarks: frame.landmarks ? toRecorded(frame.landmarks) : null
    })
  }

  finish(): LandmarkRecording {
    return {
      version: RECORDING_VERSION,
      label: this.label,
      recordedAt: this.now().toISOString(),
      frameSize: { ...this.frameSize },
      frames: [...this.frames]
    }
  }
}

// One frame per line, so a recording stays readable and a change shows up cleanly in git diffs.
export function serializeRecording(recording: LandmarkRecording): string {
  const { frames, ...header } = recording
  const headerLines = Object.entries(header).map(
    ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`
  )
  const frameLines = frames.map((frame) => `    ${JSON.stringify(frame)}`).join(',\n')

  return `{\n${headerLines.join('\n')}\n  "frames": [\n${frameLines}\n  ]\n}\n`
}

export type ParsedRecording =
  { ok: true; recording: LandmarkRecording } | { ok: false; error: string }

export function parseRecording(text: string): ParsedRecording {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'the file is not valid JSON' }
  }

  const result = recordingSchema.safeParse(raw)
  if (result.success) return { ok: true, recording: result.data }

  const issue = result.error.issues[0]
  const path = issue?.path.join('.')
  return {
    ok: false,
    error: path ? `${path}: ${issue?.message}` : (issue?.message ?? 'invalid recording')
  }
}

// A safe file name for a download, whatever the user typed as label.
export function recordingFileName(label: string, recordedAt: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const stamp = recordedAt.replace(/[:.]/g, '-').replace(/Z$/, '')
  return `${slug || 'recording'}-${stamp}.json`
}
