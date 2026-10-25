import type { HandObservation } from './handFrame'
import type { ObjectBox } from './objectFrame'
import { HAND_LANDMARK as H, POSE_LANDMARK as P, type Landmark } from './landmarks'
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

const HAND_LINE_COLOR = 'rgba(251, 191, 36, 0.9)'

// The palm, then each finger from its base to its tip.
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [H.WRIST, H.THUMB_CMC],
  [H.THUMB_CMC, H.THUMB_MCP],
  [H.THUMB_MCP, H.THUMB_IP],
  [H.THUMB_IP, H.THUMB_TIP],
  [H.WRIST, H.INDEX_MCP],
  [H.INDEX_MCP, H.INDEX_PIP],
  [H.INDEX_PIP, H.INDEX_DIP],
  [H.INDEX_DIP, H.INDEX_TIP],
  [H.INDEX_MCP, H.MIDDLE_MCP],
  [H.MIDDLE_MCP, H.MIDDLE_PIP],
  [H.MIDDLE_PIP, H.MIDDLE_DIP],
  [H.MIDDLE_DIP, H.MIDDLE_TIP],
  [H.MIDDLE_MCP, H.RING_MCP],
  [H.RING_MCP, H.RING_PIP],
  [H.RING_PIP, H.RING_DIP],
  [H.RING_DIP, H.RING_TIP],
  [H.RING_MCP, H.PINKY_MCP],
  [H.WRIST, H.PINKY_MCP],
  [H.PINKY_MCP, H.PINKY_PIP],
  [H.PINKY_PIP, H.PINKY_DIP],
  [H.PINKY_DIP, H.PINKY_TIP]
]

const OBJECT_COLOR = 'rgba(251, 191, 36, 0.95)'

// Draws the box of the object over what is already drawn, with its name on a tab above it so that
// the person knows what the camera found. Passing null draws nothing. When the picture is shown
// as in a mirror (the canvas is flipped by the page), the name is flipped back so it reads right.
export function drawObjectBox(
  ctx: CanvasRenderingContext2D,
  box: ObjectBox | null,
  width: number,
  height: number,
  label?: string,
  mirrored = false
): void {
  if (!box) return
  ctx.lineWidth = Math.max(2, width / 320)
  ctx.strokeStyle = OBJECT_COLOR
  const x = box.x * width
  const y = box.y * height
  ctx.strokeRect(x, y, box.width * width, box.height * height)
  if (!label) return

  const size = Math.max(14, Math.round(width / 46))
  ctx.font = `700 ${size}px system-ui, sans-serif`
  const padding = size * 0.6
  const tabWidth = ctx.measureText(label).width + padding * 2
  const tabHeight = size * 1.7
  // Above the box, or inside its top edge when the box touches the top of the picture.
  const top = y - tabHeight >= 0 ? y - tabHeight : y
  ctx.fillStyle = OBJECT_COLOR
  ctx.fillRect(x, top, tabWidth, tabHeight)
  ctx.fillStyle = '#1a0f0c'
  ctx.textBaseline = 'middle'
  ctx.save()
  if (mirrored) {
    // Turn around the middle of the tab, so that the name stays inside it.
    ctx.translate(x + tabWidth / 2, top + tabHeight / 2)
    ctx.scale(-1, 1)
    ctx.textAlign = 'center'
    ctx.fillText(label, 0, 0)
  } else {
    ctx.fillText(label, x + padding, top + tabHeight / 2)
  }
  ctx.restore()
}

// Draws the hands over the body, which drawSkeleton has just drawn (it clears the canvas first).
export function drawHands(
  ctx: CanvasRenderingContext2D,
  hands: readonly HandObservation[],
  width: number,
  height: number
): void {
  const lineWidth = Math.max(2, width / 320)
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.strokeStyle = HAND_LINE_COLOR
  ctx.fillStyle = POINT_COLOR

  for (const { landmarks } of hands) {
    for (const [from, to] of HAND_CONNECTIONS) {
      const a = landmarks[from]
      const b = landmarks[to]
      if (!a || !b) continue
      ctx.beginPath()
      ctx.moveTo(a.x * width, a.y * height)
      ctx.lineTo(b.x * width, b.y * height)
      ctx.stroke()
    }
    for (const point of landmarks) {
      ctx.beginPath()
      ctx.arc(point.x * width, point.y * height, lineWidth, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
