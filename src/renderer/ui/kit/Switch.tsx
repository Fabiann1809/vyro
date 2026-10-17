// An on-off switch. It is a real checkbox underneath, so the keyboard and a screen reader treat it as
// one; it is only drawn as a switch.
export function Switch({
  checked,
  onChange,
  disabled = false,
  label
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
}): React.JSX.Element {
  return (
    <label
      className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
    >
      <span className="text-[0.9375rem] font-medium">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="relative h-7.5 w-13 shrink-0 cursor-pointer appearance-none rounded-full bg-track transition-colors before:absolute before:top-0.75 before:left-0.75 before:size-6 before:rounded-full before:bg-t1 before:transition-transform checked:bg-brand checked:before:translate-x-5.5 checked:before:bg-on-brand disabled:cursor-not-allowed"
      />
    </label>
  )
}
