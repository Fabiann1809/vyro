import { useState } from 'react'
import { t } from '@renderer/i18n'
import { Button } from '../kit/Button'
import { AuthFrame } from '../kit/AuthFrame'
import { resolveLocalData, useLocalData } from '../localDataStore'

// Shown once, right after the first sign-in on a computer that already had data from before the
// accounts: what is kept in the account, and what is deleted, is the person's choice (D21).
export function LocalDataScreen(): React.JSX.Element {
  const counts = useLocalData((state) => state.counts)
  const failed = useLocalData((state) => state.failed)
  const [busy, setBusy] = useState(false)

  const choose = async (keep: boolean): Promise<void> => {
    setBusy(true)
    await resolveLocalData(window.api, keep)
    setBusy(false)
  }

  const lines = [
    counts && counts.sessions > 0 && t('localData.sessions', { count: counts.sessions }),
    counts && counts.paths > 0 && t('localData.paths', { count: counts.paths }),
    counts && counts.skills > 0 && t('localData.skills', { count: counts.skills })
  ].filter((line): line is string => typeof line === 'string')

  return (
    <AuthFrame>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-extrabold">{t('localData.title')}</h1>
        <p className="text-sm text-mut">{t('localData.body')}</p>
        <ul className="list-disc pl-5 text-sm">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {failed && (
        <p role="alert" className="text-sm text-bad-text">
          {t('localData.error')}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button size="lg" disabled={busy} onClick={() => void choose(true)}>
          {t('localData.keep')}
        </Button>
        <Button variant="secondary" size="lg" disabled={busy} onClick={() => void choose(false)}>
          {t('localData.discard')}
        </Button>
        <p className="text-xs text-mut2">{t('localData.discardNote')}</p>
      </div>
    </AuthFrame>
  )
}
