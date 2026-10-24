import { Card } from '../kit/Card'

// One block of settings: a heading, a line that says what it is for, and what can be changed.
export function SettingsCard({
  title,
  description,
  children
}: {
  title?: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Card className="flex flex-col gap-4 p-6">
      {(title || description) && (
        <div>
          {title && <h3 className="text-lg font-bold">{title}</h3>}
          {description && <p className="mt-1 text-sm leading-normal text-mut">{description}</p>}
        </div>
      )}
      {children}
    </Card>
  )
}

// A group of choices drawn as a row of pills, of which one is chosen: a real set of radio buttons.
export function Choice<Value extends string>({
  name,
  label,
  value,
  options,
  onChange
}: {
  name: string
  label: string
  value: Value
  options: ReadonlyArray<{ id: Value; label: string }>
  onChange: (value: Value) => void
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-1 self-start rounded-full bg-sunk p-1.25"
    >
      {options.map((option) => (
        <label key={option.id} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
            className="peer sr-only"
          />
          <span className="flex h-9 items-center rounded-full px-4 text-[0.84rem] whitespace-nowrap text-mut transition-colors peer-checked:bg-grad peer-checked:font-semibold peer-checked:text-on-brand peer-focus-visible:outline-3 peer-focus-visible:outline-(--focus)">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  )
}
