import { useEffect, useState } from 'react'
import { t, type MessageKey } from '@renderer/i18n'
import type { AiKeyStatus } from '@shared/ai'
import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  isSafeAiBaseUrl,
  type AiProviderId
} from '@shared/aiProviders'
import {
  DEFAULT_DAILY_TOKEN_LIMIT,
  MAX_DAILY_TOKEN_LIMIT,
  MIN_DAILY_TOKEN_LIMIT
} from '@shared/settings'
import { Button } from './kit/Button'
import { Card } from './kit/Card'
import { CoachAvatar } from './kit/CoachAvatar'
import { FIELD, FIELD_LABEL } from './kit/fields'
import { Switch } from './kit/Switch'
import { SettingsCard } from './settings/SettingsCard'
import { useSettings } from './settingsStore'

const PROVIDER_LABEL: Record<AiProviderId, MessageKey> = {
  claude: 'settings.ai.provider.claude',
  groq: 'settings.ai.provider.groq',
  gemini: 'settings.ai.provider.gemini',
  ollama: 'settings.ai.provider.ollama',
  custom: 'settings.ai.provider.custom'
}

const MAX_MODEL_LENGTH = 100

// The AI coach: off until there is a key (when the provider needs one) and the user turns it on.
// The key goes to the main process and stays there; this page only learns whether one exists.
export function AiSettings(): React.JSX.Element {
  const settings = useSettings()
  const [status, setStatus] = useState<AiKeyStatus | null>(null)
  const [used, setUsed] = useState(0)
  const [draft, setDraft] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  // What is typed is only saved when the field is left and it makes sense.
  const [modelDraft, setModelDraft] = useState(settings.aiModel ?? '')
  const [urlDraft, setUrlDraft] = useState(settings.aiBaseUrl ?? '')
  const [urlInvalid, setUrlInvalid] = useState(false)
  const [limitDraft, setLimitDraft] = useState(String(settings.aiDailyTokenLimit))
  // The consent is asked the first time the switch is turned on.
  const [askingConsent, setAskingConsent] = useState(false)
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

  useEffect(() => {
    let cancelled = false
    window.api.ai
      .usageToday()
      .then((usage) => {
        if (!cancelled) setUsed(usage.tokens)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const provider = AI_PROVIDERS[settings.aiProvider]
  const hasKey = status?.hasKey === true
  const canEnable = !provider.requiresKey || hasKey
  const percent = Math.min(100, Math.round((used / settings.aiDailyTokenLimit) * 100))

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

  // Whatever is typed ends up inside the allowed range; text that is not a number goes back to
  // what was saved.
  const commitLimit = (): void => {
    const typed = Math.round(Number(limitDraft))
    const next =
      Number.isFinite(typed) && limitDraft.trim() !== ''
        ? Math.min(MAX_DAILY_TOKEN_LIMIT, Math.max(MIN_DAILY_TOKEN_LIMIT, typed))
        : settings.aiDailyTokenLimit
    setLimitDraft(String(next))
    settings.setAiDailyTokenLimit(next)
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
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-5 p-6">
        <CoachAvatar size={44} />
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{t('settings.ai')}</h3>
          <p className="mt-1 text-sm leading-normal text-mut">{t('settings.ai.sends')}</p>
          <p className="mt-1 text-sm leading-normal text-mut">{t('settings.ai.neverSends')}</p>
        </div>
        <div className="w-60 shrink-0">
          <Switch
            label={t('settings.ai.enabled')}
            checked={settings.aiEnabled && canEnable}
            disabled={!canEnable}
            onChange={(checked) => {
              if (checked && !settings.aiConsent) setAskingConsent(true)
              else settings.setAiEnabled(checked)
            }}
          />
        </div>
      </Card>

      {askingConsent && (
        <Card
          role="alertdialog"
          aria-label={t('settings.ai.consent.title')}
          className="flex flex-col gap-3 border-warn/50 p-6"
        >
          <p className="text-lg font-semibold">{t('settings.ai.consent.title')}</p>
          <p className="text-sm leading-normal text-t4">{t('settings.ai.consent.sends')}</p>
          <p className="text-sm leading-normal text-t4">
            {t('settings.ai.consent.to', { provider: t(PROVIDER_LABEL[settings.aiProvider]) })}
          </p>
          <p className="text-sm leading-normal text-t4">{t('settings.ai.consent.notAdvice')}</p>
          <p className="text-sm leading-normal text-t4">{t('settings.ai.consent.off')}</p>
          <div className="flex gap-2.5">
            <Button
              onClick={() => {
                settings.setAiConsent(true)
                settings.setAiEnabled(true)
                setAskingConsent(false)
              }}
            >
              {t('settings.ai.consent.accept')}
            </Button>
            <Button variant="secondary" onClick={() => setAskingConsent(false)}>
              {t('settings.ai.consent.cancel')}
            </Button>
          </div>
        </Card>
      )}
      {!canEnable && <p className="text-sm text-mut">{t('settings.ai.needKey')}</p>}

      <SettingsCard>
        <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={FIELD_LABEL}>{t('settings.ai.provider')}</span>
            <select
              value={settings.aiProvider}
              onChange={(event) => settings.setAiProvider(event.target.value as AiProviderId)}
              className={FIELD}
            >
              {AI_PROVIDER_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(PROVIDER_LABEL[id])}
                </option>
              ))}
            </select>
          </label>

          {provider.requiresKey &&
            (status && !status.encryptionAvailable ? (
              <p role="alert" className="self-end text-sm text-bad-text">
                {t('settings.ai.noEncryption')}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <span className={FIELD_LABEL}>{t('settings.ai.keyLabel')}</span>
                <div className="flex gap-2.5">
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={t('settings.ai.keyLabel')}
                    placeholder={hasKey ? '••••••••••••' : t('settings.ai.keyLabel')}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className={`${FIELD} min-w-0 flex-1 font-mono`}
                  />
                  <Button disabled={draft.trim().length === 0} onClick={saveKey}>
                    {t('settings.ai.save')}
                  </Button>
                  {hasKey && (
                    <Button variant="secondary" onClick={removeKey}>
                      {t('settings.ai.remove')}
                    </Button>
                  )}
                </div>
              </div>
            ))}

          {settings.aiProvider !== 'claude' && (
            <label className="flex flex-col gap-2">
              <span className={FIELD_LABEL}>{t('settings.ai.model')}</span>
              <input
                type="text"
                value={modelDraft}
                maxLength={MAX_MODEL_LENGTH}
                placeholder={provider.models.capable ?? ''}
                onChange={(event) => setModelDraft(event.target.value)}
                onBlur={commitModel}
                className={FIELD}
              />
              <span className="text-[0.78rem] text-mut2">{t('settings.ai.modelHint')}</span>
            </label>
          )}

          {provider.baseUrlEditable && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-2">
                <span className={FIELD_LABEL}>{t('settings.ai.baseUrl')}</span>
                <input
                  type="url"
                  value={urlDraft}
                  placeholder={provider.baseUrl ?? 'https://…/v1'}
                  aria-invalid={urlInvalid}
                  onChange={(event) => setUrlDraft(event.target.value)}
                  onBlur={commitUrl}
                  className={FIELD}
                />
              </label>
              {urlInvalid && (
                <p role="alert" className="text-sm text-bad-text">
                  {t('settings.ai.baseUrlInvalid')}
                </p>
              )}
            </div>
          )}
        </div>

        {(settings.aiProvider === 'groq' || settings.aiProvider === 'gemini') && (
          <p className="text-sm text-mut">{t('settings.ai.hint.free')}</p>
        )}
        {settings.aiProvider === 'ollama' && (
          <p className="text-sm text-mut">{t('settings.ai.hint.ollama')}</p>
        )}
        {provider.requiresKey && (
          <>
            <p role="status" className="text-sm text-t4">
              {hasKey ? t('settings.ai.keySaved') : t('settings.ai.noKey')}
            </p>
            <p className="text-[0.8125rem] text-mut2">{t('settings.ai.keyShared')}</p>
          </>
        )}
        {saveFailed && (
          <p role="alert" className="text-sm text-bad-text">
            {t('settings.ai.saveFailed')}
          </p>
        )}
      </SettingsCard>

      <SettingsCard>
        <label className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>{t('settings.ai.dailyLimit')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_DAILY_TOKEN_LIMIT}
            max={MAX_DAILY_TOKEN_LIMIT}
            step={10_000}
            value={limitDraft}
            onChange={(event) => setLimitDraft(event.target.value)}
            onBlur={commitLimit}
            className={`${FIELD} w-60`}
          />
        </label>
        <div>
          <div className="flex justify-between text-[0.8125rem] text-mut">
            <span>{t('settings.ai.usage')}</span>
            <span className="text-t1">
              {t('settings.ai.usageValue', {
                used: used.toLocaleString(),
                limit: settings.aiDailyTokenLimit.toLocaleString()
              })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('settings.ai.usage')}
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-line/7"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${percent >= 90 ? 'bg-warn' : 'bg-good'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <p className="text-sm text-mut">
          {t('settings.ai.dailyLimitHint', {
            tokens: DEFAULT_DAILY_TOKEN_LIMIT.toLocaleString()
          })}
        </p>
      </SettingsCard>
    </div>
  )
}
