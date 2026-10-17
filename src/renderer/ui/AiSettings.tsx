import { useEffect, useState } from 'react'
import { t } from '@renderer/i18n'
import type { AiKeyStatus } from '@shared/ai'
import { useSettings } from './settingsStore'

// The AI coach: off until there is a key and the user turns it on. The key goes to the main
// process and stays there; this page only learns whether one exists.
export function AiSettings(): React.JSX.Element {
  const aiEnabled = useSettings((state) => state.aiEnabled)
  const setAiEnabled = useSettings((state) => state.setAiEnabled)
  const [status, setStatus] = useState<AiKeyStatus | null>(null)
  const [draft, setDraft] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  // Bumped to ask for the status again after the key changes.
  const [statusVersion, setStatusVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    window.api.ai
      .keyStatus()
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch(() => {
        if (!cancelled) setStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [statusVersion])

  const saveKey = (): void => {
    window.api.ai
      .saveKey(draft)
      .then(() => {
        // The key must not linger in the page once it has been handed over.
        setDraft('')
        setSaveFailed(false)
        setStatusVersion((version) => version + 1)
      })
      .catch(() => setSaveFailed(true))
  }

  const removeKey = (): void => {
    window.api.ai
      .clearKey()
      .then(() => {
        setAiEnabled(false)
        setStatusVersion((version) => version + 1)
      })
      .catch(() => setSaveFailed(true))
  }

  const hasKey = status?.hasKey === true

  return (
    <>
      <p>{t('settings.ai.sends')}</p>
      <p>{t('settings.ai.neverSends')}</p>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={aiEnabled && hasKey}
          disabled={!hasKey}
          onChange={(event) => setAiEnabled(event.target.checked)}
          className="size-5"
        />
        {t('settings.ai.enabled')}
      </label>
      {!hasKey && <p className="text-slate-600 dark:text-slate-400">{t('settings.ai.needKey')}</p>}

      {status && !status.encryptionAvailable ? (
        <p role="alert">{t('settings.ai.noEncryption')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-label={t('settings.ai.keyLabel')}
            placeholder={t('settings.ai.keyLabel')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-64 rounded bg-slate-200 px-3 py-2 dark:bg-slate-800"
          />
          <button
            type="button"
            disabled={draft.trim().length === 0}
            onClick={saveKey}
            className="rounded-md bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {t('settings.ai.save')}
          </button>
          {hasKey && (
            <button
              type="button"
              onClick={removeKey}
              className="rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
            >
              {t('settings.ai.remove')}
            </button>
          )}
        </div>
      )}

      <p role="status">{hasKey ? t('settings.ai.keySaved') : t('settings.ai.noKey')}</p>
      {saveFailed && <p role="alert">{t('settings.ai.saveFailed')}</p>}
    </>
  )
}
