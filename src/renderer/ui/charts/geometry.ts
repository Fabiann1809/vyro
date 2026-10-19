// The numbers behind the charts: where each point goes, how long a line is, which way it trends.
// Pure functions, so the drawing components stay thin and the maths can be tested.

export interface Point {
  x: number
  y: number
}

export interface Frame {
  width: number
  height: number
  // Room left empty on each side, for labels and for the dots not to be cut off.
  padX: number
  // The right side, when it needs less than the left; the same as padX when left out.
  padRight?: number
  padY: number
}

export interface Range {
  min: number
  max: number
}

// The vertical position of a value: the maximum at the top edge of the drawing area.
export function yOf(value: number, frame: Frame, range: Range): number {
  const span = range.max - range.min || 1
  const unit = (range.max - value) / span
  return frame.padY + unit * (frame.height - 2 * frame.padY)
}

// The points of a series, evenly spaced from left to right. One point sits in the middle.
export function seriesPoints(values: readonly number[], frame: Frame, range: Range): Point[] {
  const count = values.length
  const usable = frame.width - frame.padX - (frame.padRight ?? frame.padX)
  return values.map((value, index) => ({
    x: frame.padX + (count === 1 ? usable / 2 : (index * usable) / (count - 1)),
    y: yOf(value, frame, range)
  }))
}

const round = (value: number): string => (Math.round(value * 10) / 10).toString()

// The path of a line through the points.
export function linePath(points: readonly Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join(' ')
}

// The path of the area under the line, down to the bottom edge of the frame.
export function areaPath(points: readonly Point[], bottom: number): string {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return ''
  return `${linePath(points)} L${round(last.x)} ${round(bottom)} L${round(first.x)} ${round(bottom)} Z`
}

// How long the line is: what a line needs to be "drawn" by moving its dash.
export function pathLength(points: readonly Point[]): number {
  let length = 0
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]!
    const to = points[index]!
    length += Math.hypot(to.x - from.x, to.y - from.y)
  }
  return Math.ceil(length) + 2
}

// The straight line that best follows the values (least squares), as its height at the first and the
// last point. A single value has no trend.
export function trend(values: readonly number[]): { first: number; last: number } | null {
  const count = values.length
  if (count < 2) return null
  const meanX = (count - 1) / 2
  const meanY = values.reduce((sum, value) => sum + value, 0) / count
  let along = 0
  let spread = 0
  values.forEach((value, index) => {
    along += (index - meanX) * (value - meanY)
    spread += (index - meanX) ** 2
  })
  const slope = along / spread
  return { first: meanY - slope * meanX, last: meanY + slope * meanX }
}

// The position of the highest value; the first one if several tie. -1 when there are none.
export function bestIndex(values: readonly number[]): number {
  let best = -1
  values.forEach((value, index) => {
    if (best === -1 || value > values[best]!) best = index
  })
  return best
}

// Round values to put on the side of a chart: the ends and the middle of a range.
export function ticks(range: Range): number[] {
  return [range.min, (range.min + range.max) / 2, range.max]
}

// How much of a bar is filled, 0 to 1, for a count out of a total.
export function share(count: number, total: number): number {
  return total <= 0 ? 0 : Math.min(1, Math.max(0, count / total))
}

// The length of the arc of a ring, out of 100, for the dash of a circle.
export function ringDash(radius: number, percent: number): { length: number; offset: number } {
  const length = 2 * Math.PI * radius
  const done = Math.min(100, Math.max(0, percent)) / 100
  return { length, offset: length * (1 - done) }
}

// Where a value falls between the two ends of a scale, as a percentage: for a needle.
export function percentOn(value: number, range: Range): number {
  const span = range.max - range.min || 1
  return Math.min(100, Math.max(0, ((value - range.min) / span) * 100))
}

// The labels to show under a chart: the first, the last and a few in between, never crowded.
export function pickLabels(labels: readonly string[], most = 4): string[] {
  if (labels.length <= most) return [...labels]
  return Array.from(
    { length: most },
    (_, slot) => labels[Math.round((slot * (labels.length - 1)) / (most - 1))]!
  )
}
