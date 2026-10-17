import { QUALITY_FILL, type Quality } from './quality'

const HEIGHT: Record<Quality, string> = { good: '100%', warn: '56%', bad: '20%' }

// One bar for each repetition, in order, as tall as it was good: a technique that wears out shows
// as bars that shrink towards the right.
export function QualityBars({
  qualities,
  labels,
  summary,
  height = 'h-24'
}: {
  qualities: readonly Quality[]
  // What each bar says when pointed at: "Repetition 3: good".
  labels: readonly string[]
  summary: string
  height?: string
}): React.JSX.Element {
  return (
    <div role="img" aria-label={summary} className={`flex items-end gap-0.75 ${height}`}>
      {qualities.map((quality, index) => (
        <div
          key={index}
          title={labels[index]}
          className={`anim-up flex-1 origin-bottom rounded-[3px] ${QUALITY_FILL[quality]}`}
          style={{ height: HEIGHT[quality], animationDelay: `${index * 25}ms` }}
        />
      ))}
    </div>
  )
}
