import { useState } from 'react'
import { t } from '@renderer/i18n'
import type { CoachError, CoachSummaryReply, SessionDigest } from '@shared/coach'
import { CoachErrorNotice } from './CoachErrorNotice'
import { useNavigation } from './navigation'
import { useSettings } from './settingsStore'

type State =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'done'; reply: CoachSummaryReply }
  | { status: 'failed'; error: CoachError }

// A few words from the coach about the session that just ended. What is sent is the digest of
// numbers, never anything of the picture; the main process checks it again before it leaves.
export function CoachSummary({ digest }: { digest: SessionDigest }): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const aiEnabled = useSettings((state) => state.aiEnabled)
  const language = useSettings((state) => state.language)
  const [state, setState] = useState<State>({ status: 'idle' })

  const ask = (): void => {
    setState({ status: 'pending' })
    window.api.coach
      .summarize({ session: digest, language })
      .then((result) =>
        setState(
          result.ok
            ? { status: 'done', reply: result.value }
            : { status: 'failed', error: result.error }
        )
      )
      .catch(() => setState({ status: 'failed', error: { kind: 'unknown' } }))
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{t('coach.summary.title')}</h2>

      {!aiEnabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-slate-600 dark:text-slate-400">{t('coach.summary.off')}</p>
          <button
            type="button"
            onClick={() => go('settings')}
            className="rounded-md bg-slate-200 px-3 py-1.5 dark:bg-slate-800"
          >
            {t('coach.openSettings')}
          </button>
        </div>
      ) : (
        <>
          {state.status !== 'done' && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={ask}
                disabled={state.status === 'pending'}
                className="rounded-md bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
              >
                {t('coach.summary.ask')}
              </button>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('coach.summary.privacy')}
              </p>
            </div>
          )}

          <div aria-live="polite">
            {state.status === 'pending' && (
              <p role="status" className="text-slate-600 dark:text-slate-400">
                {t('coach.summary.pending')}
              </p>
            )}
            {state.status === 'done' && (
              <div className="flex flex-col gap-2">
                <p>{state.reply.summary}</p>
                <p>
                  <span className="font-semibold">{t('coach.summary.tip')}</span> {state.reply.tip}
                </p>
              </div>
            )}
          </div>
          {state.status === 'failed' && <CoachErrorNotice error={state.error} onRetry={ask} />}
        </>
      )}
    </div>
  )
}
