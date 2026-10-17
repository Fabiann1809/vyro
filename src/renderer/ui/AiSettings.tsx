import { useEffect, useState } from 'react'
import { t, type MessageKey } from '@renderer/i18n'
import type { AiKeyStatus } from '@shared/ai'
import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  isSafeAiBaseUrl,
  type AiProviderId
} from '@shared/aiProviders'
import { useSettings } from './settingsStore'

const PROVIDER_LABEL: Record<AiProviderId, MessageKey> = {
  claude: 'settings.ai.provider.claude',
  groq: 'settings.ai.provider.groq',
  gemini: 'settings.ai.provider.gemini',
  ollama: 'settings.ai.provider.ollama',
  custom: 'settings.ai.provider.custom'
}

const MAX_MODEL_LENGTH = 100

const inputClass = 'min-w-64 rounded bg-slate-200 px-3 py-2 dark:bg-slate-800'

// The AI coach: off until there is a key (when the provider needs one) and the user turns it on.
// The key goes to the main process and stays there; this page only learns whether one exists.
export function AiSettings(): React.JSX.Element {
  const settings = useSettings()
  const [status, setStatus] = useState<AiKeyStatus | null>(null)
  const [draft, setDraft] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  // What is typed is only saved when the field is left and it makes sense.
  const [modelDraft, setModelDraft] = useState(settings.aiModel ?? '')
  const [urlDraft, setUrlDraft] = useState(settings.aiBaseUrl ?? '')
  const [urlInvalid, setUrlInvalid] = useState(false)
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

  const provider = AI_PROVIDERS[settings.aiProvider]
  const hasKey = status?.hasKey === true
  const canEnable = !provider.requiresKey || hasKey

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
        settings.setAiEnabled(false)
        setStatusVersion((version) => version + 1)
      })
      .catch(() => setSaveFailed(true))
  }

  const commitModel = (): void => {
    const model = modelDraft.trim().slice(0, MAX_MODEL_LENGTH)
    settings.setAiModel(model === '' ? null : model)
  }

  const commitUrl = (): void => {
    const url = urlDraft.trim()
    if (url === '') {
      setUrlInvalid(false)
      settings.setAiBaseUrl(null)
    } else if (isSafeAiBaseUrl(url)) {
      setUrlInvalid(false)
      settings.setAiBaseUrl(url)
    } else {
      setUrlInvalid(true)
    }
  }

  return (
    <>
      <p>{t('settings.ai.sends')}</p>
      <p>{t('settings.ai.neverSends')}</p>

      <label className="flex flex-wrap items-center gap-3">
        {t('settings.ai.provider')}
        <select
          value={settings.aiProvider}
          onChange={(event) => settings.setAiProvider(event.target.value as AiProviderId)}
          className="rounded bg-slate-200 px-3 py-2 dark:bg-slate-800"
        >
          {AI_PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>
              {t(PROVIDER_LABEL[id])}
            </option>
          ))}
        </select>
      </label>

      {(settings.aiProvider === 'groq' || settings.aiProvider === 'gemini') && (
        <p className="text-slate-600 dark:text-slate-400">{t('settings.ai.hint.free')}</p>
      )}
      {settings.aiProvider === 'ollama' && (
        <p className="text-slate-600 dark:text-slate-400">{t('settings.ai.hint.ollama')}</p>
      )}

      {settings.aiProvider !== 'claude' && (
        <label className="flex flex-wrap items-center gap-3">
          {t('settings.ai.model')}
          <input
            type="text"
            value={modelDraft}
            maxLength={MAX_MODEL_LENGTH}
            placeholder={provider.models.capable ?? ''}
            onChange={(event) => setModelDraft(event.target.value)}
            onBlur={commitModel}
            className={inputClass}
          />
          <span className="text-slate-600 dark:text-slate-400">{t('settings.ai.modelHint')}</span>
        </label>
      )}

      {provider.baseUrlEditable && (
        <div className="flex flex-col gap-1">
          <label className="flex flex-wrap items-center gap-3">
            {t('settings.ai.baseUrl')}
            <input
              type="url"
              value={urlDraft}
              placeholder={provider.baseUrl ?? 'https://…/v1'}
              aria-invalid={urlInvalid}
              onChange={(event) => setUrlDraft(event.target.value)}
              onBlur={commitUrl}
              className={inputClass}
            />
          </label>
          {urlInvalid && <p role="alert">{t('settings.ai.baseUrlInvalid')}</p>}
        </div>
      )}

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={settings.aiEnabled && canEnable}
          disabled={!canEnable}
          onChange={(event) => settings.setAiEnabled(event.target.checked)}
          className="size-5"
        />
        {t('settings.ai.enabled')}
      </label>
      {!canEnable && (
        <p className="text-slate-600 dark:text-slate-400">{t('settings.ai.needKey')}</p>
      )}

      {provider.requiresKey &&
        (status && !status.encryptionAvailable ? (
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
              className={inputClass}
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
        ))}

      {provider.requiresKey && (
        <>
          <p role="status">{hasKey ? t('settings.ai.keySaved') : t('settings.ai.noKey')}</p>
          <p className="text-slate-600 dark:text-slate-400">{t('settings.ai.keyShared')}</p>
        </>
      )}
      {saveFailed && <p role="alert">{t('settings.ai.saveFailed')}</p>}
    </>
  )
}
