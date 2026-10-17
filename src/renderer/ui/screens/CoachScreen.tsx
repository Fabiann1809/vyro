import { useEffect, useRef, useState } from 'react'
import { t, type MessageKey } from '@renderer/i18n'
import { MAX_COACH_TURN_LENGTH, type CoachError, type CoachErrorKind } from '@shared/coach'
import { AI_PROVIDERS } from '@shared/aiProviders'
import { resetCoach, retryCoach, sendToCoach, useCoach } from '../coachStore'
import { useNavigation } from '../navigation'
import { useSettings } from '../settingsStore'

const ERROR_TEXT: Record<CoachErrorKind, MessageKey> = {
  'no-key': 'coach.error.no-key',
  auth: 'coach.error.auth',
  'rate-limit': 'coach.error.rate-limit',
  timeout: 'coach.error.timeout',
  network: 'coach.error.network',
  server: 'coach.error.server',
  request: 'coach.error.request',
  refused: 'coach.error.refused',
  cancelled: 'coach.error.cancelled',
  'not-configured': 'coach.error.not-configured',
  blocked: 'coach.error.blocked',
  'invalid-response': 'coach.error.invalid-response',
  truncated: 'coach.error.truncated',
  unknown: 'coach.error.unknown',
  'not-enabled': 'coach.error.not-enabled',
  busy: 'coach.error.busy',
  'invalid-input': 'coach.error.invalid-input'
}

// A different try will not help: something has to change in Settings first.
const NEEDS_SETTINGS: ReadonlySet<CoachErrorKind> = new Set([
  'no-key',
  'auth',
  'not-configured',
  'not-enabled',
  'request'
])

function errorMessage(error: CoachError): string {
  if (error.kind === 'rate-limit' && error.retryAfterSeconds !== undefined) {
    return t('coach.error.rate-limit-wait', { seconds: Math.ceil(error.retryAfterSeconds) })
  }
  return t(ERROR_TEXT[error.kind])
}

export function CoachScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const { aiEnabled, aiProvider, language } = useSettings()
  const { turns, pending, error } = useCoach()
  const [draft, setDraft] = useState('')
  // Whether a key is saved, when the provider needs one. Null until it is known.
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const needsKey = AI_PROVIDERS[aiProvider].requiresKey

  useEffect(() => {
    let cancelled = false
    window.api.ai
      .keyStatus()
      .then((status) => {
        if (!cancelled) setHasKey(status.hasKey)
      })
      .catch(() => {
        if (!cancelled) setHasKey(null)
      })
    return () => {
      cancelled = true
    }
  }, [aiProvider])

  // Instant, not animated: it is a jump to the last message, and some people ask for no motion.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [turns.length, pending, error])

  // Back to the box, ready to type, once an answer has arrived.
  useEffect(() => {
    if (!pending) inputRef.current?.focus()
  }, [pending])

  const send = (): void => {
    const text = draft
    if (text.trim() === '' || pending) return
    setDraft('')
    void sendToCoach(window.api, text, language)
  }

  if (!aiEnabled) {
    return (
      <section className="flex w-full max-w-2xl flex-col items-start gap-4 self-start p-8">
        <h1 className="text-3xl font-semibold">{t('screen.coach.title')}</h1>
        <h2 className="text-xl font-semibold">{t('coach.off.title')}</h2>
        <p>{t('coach.off.body')}</p>
        <button
          type="button"
          onClick={() => go('settings')}
          className="rounded-md bg-emerald-700 px-4 py-2 text-white"
        >
          {t('coach.openSettings')}
        </button>
      </section>
    )
  }

  if (needsKey && hasKey === false) {
    return (
      <section className="flex w-full max-w-2xl flex-col items-start gap-4 self-start p-8">
        <h1 className="text-3xl font-semibold">{t('screen.coach.title')}</h1>
        <p role="alert">{t('coach.error.no-key')}</p>
        <button
          type="button"
          onClick={() => go('settings')}
          className="rounded-md bg-emerald-700 px-4 py-2 text-white"
        >
          {t('coach.openSettings')}
        </button>
      </section>
    )
  }

  return (
    <section className="flex h-full w-full max-w-3xl flex-col gap-3 self-start p-6">
      <header className="flex flex-wrap items-baseline gap-4">
        <h1 className="text-3xl font-semibold">{t('screen.coach.title')}</h1>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={resetCoach}
            disabled={pending}
            className="ml-auto rounded-md bg-slate-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:bg-slate-800"
          >
            {t('coach.new')}
          </button>
        )}
      </header>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('coach.private')}</p>

      <div
        role="log"
        aria-label={t('coach.log')}
        aria-live="polite"
        aria-relevant="additions"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-slate-300 p-4 dark:border-slate-700"
      >
        {turns.length === 0 && !pending && (
          <p className="text-slate-600 dark:text-slate-400">{t('coach.intro')}</p>
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
            {t('coach.thinking')}
          </p>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <span aria-hidden="true">⚠</span>
          <p>{errorMessage(error)}</p>
          {NEEDS_SETTINGS.has(error.kind) ? (
            <button
              type="button"
              onClick={() => go('settings')}
              className="rounded-md bg-slate-200 px-3 py-1.5 dark:bg-slate-800"
            >
              {t('coach.openSettings')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void retryCoach(window.api, language)}
              disabled={pending}
              className="rounded-md bg-slate-200 px-3 py-1.5 disabled:opacity-50 dark:bg-slate-800"
            >
              {t('coach.retry')}
            </button>
          )}
        </div>
      )}

      <form
        className="flex items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm">{t('coach.input.label')}</span>
          <textarea
            ref={inputRef}
            rows={2}
            maxLength={MAX_COACH_TURN_LENGTH}
            value={draft}
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift + Enter writes a new line. Not while an input method is composing.
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                send()
              }
            }}
            className="rounded bg-slate-200 px-3 py-2 disabled:opacity-60 dark:bg-slate-800"
          />
        </label>
        <button
          type="submit"
          disabled={pending || draft.trim() === ''}
          className="rounded-md bg-emerald-700 px-5 py-2 text-white disabled:opacity-50"
        >
          {t('coach.send')}
        </button>
      </form>
    </section>
  )
}
