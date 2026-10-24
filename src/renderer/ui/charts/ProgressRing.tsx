const LENGTH = 132

// A small ring that fills as far as `share` (0 to 1), in the gradient of the brand, with whatever
// is given in the middle. It is only a picture: the number it shows must be written in words next
// to it.
export function ProgressRing({
  share,
  size = 'size-13',
  children
}: {
  share: number
  size?: string
  children?: React.ReactNode
}): React.JSX.Element {
  const filled = Math.min(1, Math.max(0, share))
  return (
    <span aria-hidden="true" className={`relative inline-flex shrink-0 ${size}`}>
      <svg viewBox="0 0 52 52" className="size-full -rotate-90">
        <defs>
          <linearGradient id="vy-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFD1A0" />
            <stop offset="0.5" stopColor="#F27A3E" />
            <stop offset="1" stopColor="#A8326A" />
          </linearGradient>
        </defs>
        <circle
          cx="26"
          cy="26"
          r="21"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="5"
        />
        <circle
          cx="26"
          cy="26"
          r="21"
          fill="none"
          stroke="url(#vy-ring-grad)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          strokeDashoffset={LENGTH * (1 - filled)}
          style={{ transition: 'stroke-dashoffset 1.2s 0.4s cubic-bezier(0.3, 0.7, 0.2, 1)' }}
        />
      </svg>
      {children && (
        <span className="absolute inset-0 flex items-center justify-center font-display text-[0.9rem] font-bold">
          {children}
        </span>
      )}
    </span>
  )
}
