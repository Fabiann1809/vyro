import { ICON_PATHS, iconViewBox, type IconName } from './icons'

// A decorative icon: the words next to it say what it means, so it is hidden from screen readers.
export function Icon({
  name,
  className = 'size-5',
  strokeWidth = 1.7
}: {
  name: IconName
  className?: string
  strokeWidth?: number
}): React.JSX.Element {
  return (
    <svg
      viewBox={iconViewBox(name)}
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}
