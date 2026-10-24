// The face of the coach: a warm sphere that breathes, with a glint that turns and two rings that
// spread out. While the coach thinks it all goes faster. It is only decoration, so screen readers
// skip it.
export function CoachAvatar({
  size = 38,
  thinking = false
}: {
  size?: number
  thinking?: boolean
}): React.JSX.Element {
  const breath = thinking ? 1 : 3.4
  const ring = thinking ? 1.1 : 3
  const turn = thinking ? 1.6 : 7

  return (
    <span
      aria-hidden="true"
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      {[0, ring / 2].map((delay) => (
        <span
          key={delay}
          className="absolute inset-0 rounded-full"
          style={{
            border: `${size > 60 ? 1.5 : 1}px solid oklch(0.8 0.14 55 / 0.8)`,
            animation: `vy-ring ${ring}s ${delay}s ease-out infinite`
          }}
        />
      ))}
      <span
        className="absolute overflow-hidden rounded-full"
        style={{
          inset: '12%',
          background:
            'radial-gradient(circle at 34% 28%, #fff3e2 0%, #ffbe7a 22%, #f2763c 52%, #b23a63 82%, #5c1e3e 100%)',
          boxShadow: `0 0 ${Math.round(size * 0.45)}px oklch(0.72 0.18 45 / 0.55), inset 0 -${Math.round(size * 0.08)}px ${Math.round(size * 0.16)}px rgba(60, 10, 30, 0.5)`,
          animation: `vy-breath ${breath}s ease-in-out infinite`
        }}
      >
        <span
          className="absolute"
          style={{
            inset: '-30%',
            background:
              'conic-gradient(from 0deg, transparent 0 55%, rgba(255, 240, 220, 0.6) 70%, transparent 85%)',
            animation: `vy-spin ${turn}s linear infinite`,
            mixBlendMode: 'soft-light'
          }}
        />
        <span
          className="absolute rounded-full bg-white/55"
          style={{
            left: '22%',
            top: '15%',
            width: '30%',
            height: '20%',
            filter: `blur(${Math.max(1, size / 30)}px)`
          }}
        />
      </span>
    </span>
  )
}
