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
        className="relative h-8.5 w-14.5 shrink-0 cursor-pointer appearance-none rounded-full bg-track shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] transition-colors before:absolute before:top-1 before:left-1 before:size-6.5 before:rounded-full before:bg-[#fff6ee] before:shadow-[0_2px_8px_rgba(0,0,0,0.3)] before:transition-transform before:duration-250 before:ease-[cubic-bezier(0.3,1.4,0.5,1)] checked:bg-grad checked:before:translate-x-6 disabled:cursor-not-allowed"
      />
    </label>
  )
}
