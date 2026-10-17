// A surface of the interface: rounded, with a faint border. "raised" is for the card that is the
// centre of attention, such as a path the coach just proposed.
export function Card({
  raised = false,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { raised?: boolean }): React.JSX.Element {
  const surface = raised
    ? 'rounded-[1.75rem] border border-line/9 bg-linear-to-b from-card to-card2 shadow-2xl shadow-black/30'
    : 'rounded-3xl border border-line/6 bg-card'
  return <div className={`${surface} ${className}`} {...props} />
}
