// The maths of a half circle gauge: a value becomes an angle, an angle becomes a point, two angles
// become an arc to draw.
export interface Scale {
  min: number
  max: number
}

// The gauge is the top half of a circle: its left end is 180 degrees and its right end is 0.
const START = 180
const END = 0

// Where a value falls on the half circle, in degrees: the minimum on the left, the maximum on the right.
export function angleOf(value: number, scale: Scale): number {
  const span = scale.max - scale.min || 1
  const unit = Math.min(1, Math.max(0, (value - scale.min) / span))
  return START + (END - START) * unit
}

const round = (value: number): string => (Math.round(value * 10) / 10).toString()

// The point at an angle (in degrees, counter-clockwise from the right) on a circle, in screen
// coordinates where y grows downwards.
export function pointAt(cx: number, cy: number, radius: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180
  return [cx + radius * Math.cos(radians), cy - radius * Math.sin(radians)]
}

// The path of the arc between two angles of the half circle, drawn from the left towards the right.
export function arcPath(cx: number, cy: number, radius: number, from: number, to: number): string {
  const [x1, y1] = pointAt(cx, cy, radius, from)
  const [x2, y2] = pointAt(cx, cy, radius, to)
  return `M${round(x1)} ${round(y1)} A${radius} ${radius} 0 0 1 ${round(x2)} ${round(y2)}`
}

// The tick marks around the arc, `count` of them evenly spread.
export function tickPath(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  count: number
): string {
  return Array.from({ length: count }, (_, index) => {
    const degrees = START + ((END - START) * index) / (count - 1)
    const [x1, y1] = pointAt(cx, cy, inner, degrees)
    const [x2, y2] = pointAt(cx, cy, outer, degrees)
    return `M${round(x1)} ${round(y1)}L${round(x2)} ${round(y2)}`
  }).join('')
}
