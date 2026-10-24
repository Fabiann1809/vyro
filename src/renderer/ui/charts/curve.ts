// A smooth line through points, drawn as cubic curves (Catmull-Rom turned into Bézier handles), and
// how long it is, so that it can be drawn as if a pen were tracing it.
export type Point = readonly [x: number, y: number]

export interface Curve {
  // The "d" of an SVG path.
  d: string
  // Its length in the units of the drawing, rounded up a little so a dash covers it all.
  length: number
  // The length from the start up to each point, for points to appear as the line reaches them.
  reach: number[]
}

const STEPS = 20

const fixed = (value: number): string => value.toFixed(1)

export function smoothCurve(points: readonly Point[]): Curve {
  const first = points[0]
  if (!first) return { d: '', length: 0, reach: [] }

  let d = `M${fixed(first[0])} ${fixed(first[1])}`
  let length = 0
  const reach = [0]

  for (let index = 0; index < points.length - 1; index++) {
    const p1 = points[index]!
    const p0 = points[index - 1] ?? p1
    const p2 = points[index + 1]!
    const p3 = points[index + 2] ?? p2
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${fixed(c1[0])} ${fixed(c1[1])} ${fixed(c2[0])} ${fixed(c2[1])} ${fixed(p2[0])} ${fixed(p2[1])}`

    let previous = p1
    for (let step = 1; step <= STEPS; step++) {
      const u = step / STEPS
      const m = 1 - u
      const x = m ** 3 * p1[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u ** 3 * p2[0]
      const y = m ** 3 * p1[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u ** 3 * p2[1]
      length += Math.hypot(x - previous[0], y - previous[1])
      previous = [x, y]
    }
    reach.push(length)
  }
  return { d, length: Math.ceil(length) + 2, reach }
}
