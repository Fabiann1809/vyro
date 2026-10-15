import { angleAt, distance, tiltFromVertical, toPixels, type Point } from '@renderer/core/geometry'
import type { Landmark } from '@renderer/core/landmarks'
import { joint, type JointName, type Side } from '@renderer/core/side'
import type { SkillConfig } from './skillSchema'

export interface FrameSize {
  width: number
  height: number
}

// One value per metric of the skill. null means "could not be measured in this frame":
// a needed joint is hidden, or two points coincide so the measure is undefined.
export type MetricValues = Record<string, number | null>

type MetricDefinition = SkillConfig['metrics'][string]

// Joints are looked up on the visible side and converted to pixels, because angles measured
// on normalized coordinates are distorted by the shape of the frame.
function pointOf(
  landmarks: readonly Landmark[],
  name: JointName,
  side: Side,
  frame: FrameSize
): Point | null {
  const landmark = joint(landmarks, name, side)
  return landmark ? toPixels(landmark, frame.width, frame.height) : null
}

function measure(metric: MetricDefinition, at: (name: JointName) => Point | null): number | null {
  switch (metric.type) {
    case 'angle': {
      const [first, vertex, last] = metric.points.map(at)
      return first && vertex && last ? angleAt(first, vertex, last) : null
    }
    case 'tilt': {
      const from = at(metric.from)
      const to = at(metric.to)
      return from && to ? tiltFromVertical(from, to) : null
    }
    case 'offset': {
      const from = at(metric.from)
      const to = at(metric.to)
      const [scaleStart, scaleEnd] = metric.scale.map(at)
      if (!from || !to || !scaleStart || !scaleEnd) return null

      const scale = distance(scaleStart, scaleEnd)
      return scale === 0 ? null : (to[metric.axis] - from[metric.axis]) / scale
    }
  }
}

export function computeMetrics(
  metrics: SkillConfig['metrics'],
  landmarks: readonly Landmark[],
  side: Side,
  frame: FrameSize
): MetricValues {
  const at = (name: JointName): Point | null => pointOf(landmarks, name, side, frame)

  return Object.fromEntries(
    Object.entries(metrics).map(([name, metric]) => [name, measure(metric, at)])
  )
}
