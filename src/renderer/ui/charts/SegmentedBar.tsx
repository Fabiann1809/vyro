import { share } from './geometry'
import { QUALITY_FILL, type Quality } from './quality'

export interface Segment {
  quality: Quality
  count: number
  // What it is called, for screen readers: "14 clean".
  label: string
}

// One bar split in parts, for how many were good, so-so and bad out of a total.
export function SegmentedBar({
  segments,
  summary
}: {
  segments: readonly Segment[]
  summary: string
}): React.JSX.Element {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0)

  return (
    <div role="img" aria-label={summary} className="flex h-4 gap-0.75 overflow-hidden rounded-full">
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => (
          <div
            key={segment.quality}
            className={QUALITY_FILL[segment.quality]}
            style={{ flex: share(segment.count, total) }}
            title={segment.label}
          />
        ))}
    </div>
  )
}
