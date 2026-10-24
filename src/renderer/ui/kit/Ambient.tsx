// The lights behind the whole interface: three soft glows that drift slowly, so that the glass
// surfaces above them have something to blur. It is only paint: it never takes a click, and with
// less motion asked for the glows stay where they are (see the end of styles.css).
export function Ambient(): React.JSX.Element {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-105 -left-70 size-245 rounded-full"
        style={{
          background: 'radial-gradient(closest-side, var(--glow-a), transparent)',
          animation: 'vy-drift-1 26s ease-in-out infinite alternate'
        }}
      />
      <div
        className="absolute -right-95 -bottom-130 size-275 rounded-full"
        style={{
          background: 'radial-gradient(closest-side, var(--glow-b), transparent)',
          animation: 'vy-drift-2 32s ease-in-out infinite alternate'
        }}
      />
      <div
        className="absolute top-[26%] left-[42%] size-160 rounded-full"
        style={{
          background: 'radial-gradient(closest-side, var(--glow-c), transparent)',
          animation: 'vy-drift-1 38s ease-in-out infinite alternate-reverse'
        }}
      />
    </div>
  )
}
