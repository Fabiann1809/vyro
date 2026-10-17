import { useEffect, useRef } from 'react'
import { t } from '@renderer/i18n'
import { MAX_COACH_TURN_LENGTH } from '@shared/coach'
import { Icon } from '../kit/Icon'

// The box where the person writes to the coach. Enter sends and Shift + Enter writes a new line; it
// takes the focus again when it can be used, so that the person can keep typing after each answer.
// "hero" is the big one of the empty screen and "dock" the one under a conversation.
export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  variant,
  label = t('coach.input.label'),
  maxLength = MAX_COACH_TURN_LENGTH
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
  placeholder: string
  variant: 'hero' | 'dock'
  // What a screen reader calls the box.
  label?: string
  maxLength?: number
}): React.JSX.Element {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hero = variant === 'hero'

  useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
      className={`ring-within flex w-full items-center gap-2.5 border border-line/9 bg-card ${
        hero
          ? 'max-w-180 rounded-[1.875rem] py-2.5 pr-2.5 pl-6.5 shadow-2xl shadow-black/40'
          : 'max-w-195 rounded-[1.625rem] py-2 pr-2 pl-5.5'
      }`}
    >
      <textarea
        ref={inputRef}
        data-composer
        rows={1}
        maxLength={maxLength}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Not while an input method is composing a character.
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            onSend()
          }
        }}
        className={`field-sizing-content max-h-36 min-w-0 flex-1 resize-none bg-transparent py-3.5 leading-snug text-t1 outline-none placeholder:text-mut2 disabled:opacity-60 ${
          hero ? 'min-h-13 text-[1.0625rem]' : 'min-h-11 text-base'
        }`}
      />
      <button
        type="submit"
        aria-label={t('coach.send')}
        title={t('coach.send')}
        disabled={disabled || value.trim() === ''}
        className={`flex shrink-0 items-center justify-center rounded-full bg-brand text-on-brand transition active:scale-95 disabled:opacity-40 ${
          hero ? 'size-13' : 'size-11'
        }`}
      >
        <Icon name="send" className="size-4.5" strokeWidth={1.8} />
      </button>
    </form>
  )
}
