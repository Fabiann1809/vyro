import { POSE_LANDMARK as P, type Landmark } from './landmarks'
import { isVisible } from './visibility'

const LINE_COLOR = 'rgba(52, 211, 153, 0.9)'
const POINT_COLOR = '#f8fafc'

// Body only: the face is reduced to a single point on the nose.
export const SKELETON_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [P.LEFT_SHOULDER, P.RIGHT_SHOULDER],
  [P.LEFT_SHOULDER, P.LEFT_HIP],
  [P.RIGHT_SHOULDER, P.RIGHT_HIP],
  [P.LEFT_HIP, P.RIGHT_HIP],
  [P.LEFT_SHOULDER, P.LEFT_ELBOW],
  [P.LEFT_ELBOW, P.LEFT_WRIST],
  [P.RIGHT_SHOULDER, P.RIGHT_ELBOW],
  [P.RIGHT_ELBOW, P.RIGHT_WRIST],
  [P.LEFT_WRIST, P.LEFT_INDEX],
  [P.RIGHT_WRIST, P.RIGHT_INDEX],
  [P.LEFT_HIP, P.LEFT_KNEE],
  [P.LEFT_KNEE, P.LEFT_ANKLE],
  [P.RIGHT_HIP, P.RIGHT_KNEE],
  [P.RIGHT_KNEE, P.RIGHT_ANKLE],
  [P.LEFT_ANKLE, P.LEFT_HEEL],
  [P.LEFT_HEEL, P.LEFT_FOOT_INDEX],
  [P.LEFT_ANKLE, P.LEFT_FOOT_INDEX],
  [P.RIGHT_ANKLE, P.RIGHT_HEEL],
  [P.RIGHT_HEEL, P.RIGHT_FOOT_INDEX],
  [P.RIGHT_ANKLE, P.RIGHT_FOOT_INDEX]
]

const POINTS: readonly number[] = [
  P.NOSE,
  ...new Set(SKELETON_CONNECTIONS.flatMap(([from, to]) => [from, to]))
]

// Draws the skeleton over a canvas of the same size as the video. Passing null just clears it.
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: readonly Landmark[] | null,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height)
  if (!landmarks) return

  const lineWidth = Math.max(2, width / 320)

  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.strokeStyle = LINE_COLOR
  for (const [from, to] of SKELETON_CONNECTIONS) {
    const a = landmarks[from]
    const b = landmarks[to]
    if (!isVisible(a) || !isVisible(b)) continue
    ctx.beginPath()
    ctx.moveTo(a.x * width, a.y * height)
    ctx.lineTo(b.x * width, b.y * height)
    ctx.stroke()
  }

  ctx.fillStyle = POINT_COLOR
  for (const index of POINTS) {
    const point = landmarks[index]
    if (!isVisible(point)) continue
    ctx.beginPath()
    ctx.arc(point.x * width, point.y * height, lineWidth * 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
}
