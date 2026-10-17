// The face of the coach: a sphere that breathes, with two rings that spread out. While the coach
// thinks it goes faster. It is only decoration, so screen readers skip it.
export function CoachAvatar({
  size = 38,
  thinking = false
}: {
  size?: number
  thinking?: boolean
}): React.JSX.Element {
  const breath = thinking ? 0.9 : 3.2
  const ring = thinking ? 1.1 : 2.8

  return (
    <span
      aria-hidden="true"
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      {[0, ring / 2].map((delay) => (
        <span
          key={delay}
          className="absolute inset-0 rounded-full border-brand"
          style={{
            borderStyle: 'solid',
            borderWidth: size > 60 ? 1.5 : 1,
            animation: `vy-ring ${ring}s ${delay}s ease-out infinite`
          }}
        />
      ))}
      <span
        className="absolute rounded-full"
        style={{
          inset: '14%',
          background:
            'radial-gradient(circle at 34% 30%, #f6ffe0, var(--brand) 52%, oklch(0.62 0.15 135))',
          animation: `vy-breath ${breath}s ease-in-out infinite`,
          boxShadow: `0 0 ${size / 2}px color-mix(in oklab, var(--brand) 35%, transparent)`
        }}
      >
        <span
          className="absolute rounded-full"
          style={{
            inset: '32%',
            border: `${Math.max(2, size / 22)}px solid #0d0f14`,
            opacity: 0.85
          }}
        />
      </span>
    </span>
  )
}
