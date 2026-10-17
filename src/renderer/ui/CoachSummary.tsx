import { useState } from 'react'
import { t } from '@renderer/i18n'
import type { CoachError, CoachSummaryReply, SessionDigest } from '@shared/coach'
import { CoachErrorNotice } from './CoachErrorNotice'
import { Button } from './kit/Button'
import { CoachAvatar } from './kit/CoachAvatar'
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
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <CoachAvatar />
        <h2 className="text-[0.8125rem] font-normal text-mut">{t('coach.summary.title')}</h2>
      </div>

      {!aiEnabled ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm leading-normal text-t4">{t('coach.summary.off')}</p>
          <Button variant="secondary" onClick={() => go('settings')}>
            {t('coach.openSettings')}
          </Button>
        </div>
      ) : (
        <>
          {state.status !== 'done' && (
            <div className="flex flex-col items-start gap-3">
              <Button onClick={ask} disabled={state.status === 'pending'}>
                {t('coach.summary.ask')}
              </Button>
              <p className="text-[0.8125rem] text-mut">{t('coach.summary.privacy')}</p>
            </div>
          )}

          <div aria-live="polite">
            {state.status === 'pending' && (
              <p role="status" className="text-sm text-mut">
                {t('coach.summary.pending')}
              </p>
            )}
            {state.status === 'done' && (
              <div className="anim-up flex flex-col gap-2.5 text-[0.9375rem] leading-relaxed text-t2">
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
