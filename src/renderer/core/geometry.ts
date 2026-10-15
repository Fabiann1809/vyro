export interface Point {
  x: number
  y: number
}

const RAD_TO_DEG = 180 / Math.PI

// Landmarks are normalized to the image (0..1), so a 16:9 frame is stretched. Angles must be
// measured after converting to pixels, otherwise they come out distorted.
export function toPixels(point: Point, width: number, height: number): Point {
  return { x: point.x * width, y: point.y * height }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

// Angle at `vertex` between the segments vertex→a and vertex→b, from 0 to 180 degrees.
// Returns null when a point coincides with the vertex, because the angle is undefined.
export function angleAt(a: Point, vertex: Point, b: Point): number | null {
  const ux = a.x - vertex.x
  const uy = a.y - vertex.y
  const vx = b.x - vertex.x
  const vy = b.y - vertex.y

  if ((ux === 0 && uy === 0) || (vx === 0 && vy === 0)) return null

  const cross = ux * vy - uy * vx
  const dot = ux * vx + uy * vy
  return Math.abs(Math.atan2(cross, dot)) * RAD_TO_DEG
}

// Angle between the segment from→to and the vertical, from 0 to 180 degrees.
// 0 means `to` is straight above `from`, 90 means level, 180 means straight below.
// Image y grows downwards, so "up" is negative y. Returns null when both points coincide.
export function tiltFromVertical(from: Point, to: Point): number | null {
  const dx = to.x - from.x
  const dy = to.y - from.y

  if (dx === 0 && dy === 0) return null

  return Math.atan2(Math.abs(dx), -dy) * RAD_TO_DEG
}
