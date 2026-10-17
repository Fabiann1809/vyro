import { useEffect, useRef } from 'react'
import { t } from '@renderer/i18n'
import { MAX_COACH_TURN_LENGTH } from '@shared/coach'
import type { CoachTurn } from './coachStore'

// The messages of a conversation with the coach, as a log that a screen reader announces as it grows.
export function ConversationLog({
  turns,
  pending,
  pendingText,
  introText,
  label
}: {
  turns: readonly CoachTurn[]
  pending: boolean
  pendingText: string
  introText: string
  label: string
}): React.JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)

  // Instant, not animated: it is a jump to the last message, and some people ask for no motion.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [turns.length, pending])

  return (
    <div
      role="log"
      aria-label={label}
      aria-live="polite"
      aria-relevant="additions"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-slate-300 p-4 dark:border-slate-700"
    >
      {turns.length === 0 && !pending && (
        <p className="text-slate-600 dark:text-slate-400">{introText}</p>
      )}
      {turns.map((turn, index) => (
        <div
          key={index}
          className={`max-w-[85%] rounded-lg px-4 py-2 ${
            turn.role === 'user'
              ? 'self-end bg-slate-200 dark:bg-slate-800'
              : 'self-start border border-slate-300 dark:border-slate-700'
          }`}
        >
          <p className="text-sm font-semibold">
            {turn.role === 'user' ? t('coach.you') : t('coach.coach')}
          </p>
          <p className="whitespace-pre-wrap">{turn.text}</p>
        </div>
      ))}
      {pending && (
        <p role="status" className="text-slate-600 dark:text-slate-400">
          {pendingText}
        </p>
      )}
      <div ref={endRef} />
    </div>
  )
}

// The box to write in. Enter sends and Shift + Enter writes a new line; it takes the focus again
// when it can be used, so that the person can keep typing after each answer.
export function MessageBox({
  label,
  value,
  onChange,
  onSend,
  disabled
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
}): React.JSX.Element {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

  return (
    <form
      className="flex items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-sm">{label}</span>
        <textarea
          ref={inputRef}
          rows={2}
          maxLength={MAX_COACH_TURN_LENGTH}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Not while an input method is composing a character.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              onSend()
            }
          }}
          className="rounded bg-slate-200 px-3 py-2 disabled:opacity-60 dark:bg-slate-800"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || value.trim() === ''}
        className="rounded-md bg-emerald-700 px-5 py-2 text-white disabled:opacity-50"
      >
        {t('coach.send')}
      </button>
    </form>
  )
}
