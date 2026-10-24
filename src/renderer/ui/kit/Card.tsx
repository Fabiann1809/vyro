// A surface of the interface: rounded, with a faint border. "raised" is for the card that is the
// centre of attention, such as a path the coach just proposed.
export function Card({
  raised = false,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { raised?: boolean }): React.JSX.Element {
  const surface = raised
    ? 'glass rounded-[2rem] bg-linear-to-b from-card to-card2'
    : 'glass rounded-[2rem]'
  return <div className={`${surface} ${className}`} {...props} />
}
