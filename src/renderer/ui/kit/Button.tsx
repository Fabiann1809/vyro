import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass'

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}): React.JSX.Element {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />
}
