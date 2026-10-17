import { useEffect, useState } from 'react'
import { t } from '@renderer/i18n'
import { AI_PROVIDERS } from '@shared/aiProviders'
import { CoachErrorNotice } from '../CoachErrorNotice'
import { resetCoach, retryCoach, sendToCoach, useCoach } from '../coachStore'
import { ConversationLog, MessageBox } from '../Conversation'
import { useNavigation } from '../navigation'
import { useSettings } from '../settingsStore'

export function CoachScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const { aiEnabled, aiProvider, language } = useSettings()
  const { turns, pending, error } = useCoach()
  const [draft, setDraft] = useState('')
  // Whether a key is saved, when the provider needs one. Null until it is known.
  const [hasKey, setHasKey] = useState<boolean | null>(null)

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
        <button
          type="button"
          onClick={() => go('skillNew')}
          className="ml-auto rounded-md bg-slate-200 px-3 py-1.5 text-sm dark:bg-slate-800"
        >
          {t('skill.new')}
        </button>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={resetCoach}
            disabled={pending}
            className="rounded-md bg-slate-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:bg-slate-800"
          >
            {t('coach.new')}
          </button>
        )}
      </header>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('coach.private')}</p>

      <ConversationLog
        turns={turns}
        pending={pending}
        pendingText={t('coach.thinking')}
        introText={t('coach.intro')}
        label={t('coach.log')}
      />

      {error && (
        <CoachErrorNotice
          error={error}
          onRetry={() => void retryCoach(window.api, language)}
          retryDisabled={pending}
        />
      )}

      <MessageBox
        label={t('coach.input.label')}
        value={draft}
        onChange={setDraft}
        onSend={send}
        disabled={pending}
      />
    </section>
  )
}
