import { t } from '@renderer/i18n'
import type { CoachError } from '@shared/coach'
import { coachErrorMessage, errorNeedsSettings } from './coachErrors'
import { useNavigation } from './navigation'

// Says why the coach did not answer, with the one thing that can help: go to Settings when it is a
// matter of setting up, or try again when it may pass by itself.
export function CoachErrorNotice({
  error,
  onRetry,
  retryDisabled = false
}: {
  error: CoachError
  onRetry: () => void
  retryDisabled?: boolean
}): React.JSX.Element {
  const go = useNavigation((state) => state.go)

  return (
    <div role="alert" className="flex flex-wrap items-center gap-3">
      <span aria-hidden="true">⚠</span>
      <p>{coachErrorMessage(error)}</p>
      {errorNeedsSettings(error) ? (
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
          onClick={onRetry}
          disabled={retryDisabled}
          className="rounded-md bg-slate-200 px-3 py-1.5 disabled:opacity-50 dark:bg-slate-800"
        >
          {t('coach.retry')}
        </button>
      )}
    </div>
  )
}
