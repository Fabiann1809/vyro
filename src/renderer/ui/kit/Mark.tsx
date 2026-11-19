// The mark of the app: a rounded square in the colour of the brand with a ring and a pulse that is
// drawn once when it appears.
export function Mark({ className = 'size-9.5' }: { className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={`${className} shrink-0 drop-shadow-[0_6px_16px_oklch(0.65_0.18_40/0.55)]`}
    >
      <defs>
        <linearGradient id="vy-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD1A0" />
          <stop offset="0.5" stopColor="#F27A3E" />
          <stop offset="1" stopColor="#A8326A" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="13" fill="url(#vy-mark)" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="#2A0F1A" strokeWidth="2.6" />
      <path
        d="M5.5 20h6.5l2.2-4.5 3.6 10 3.4-12 3 8.5 1.6-2h8.7"
        fill="none"
        stroke="#FFF6EE"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="60"
        strokeDashoffset="60"
        style={{ animation: 'vy-draw 1.4s 200ms cubic-bezier(0.3, 0.7, 0.2, 1) forwards' }}
      />
    </svg>
  )
}
