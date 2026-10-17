// The buttons of the interface. One main action per area (primary); the rest are quieter.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'light'
export type ButtonSize = 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand font-semibold',
  secondary: 'border border-line/14 bg-transparent text-t1 hover:bg-line/5',
  ghost: 'bg-transparent text-mut hover:bg-line/5 hover:text-t1',
  light: 'bg-t1 text-inv font-semibold hover:bg-brand hover:text-on-brand'
}

const SIZE: Record<ButtonSize, string> = {
  md: 'h-10.5 px-5 text-sm',
  lg: 'h-12 px-6 text-[0.9375rem]'
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap transition active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]}`
}
