import { t } from '@renderer/i18n'
import type { CoachError } from '@shared/coach'
import { coachErrorMessage, errorNeedsSettings } from './coachErrors'
import { Button } from './kit/Button'
import { Icon } from './kit/Icon'
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
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-bad/40 bg-bad/8 px-4 py-3"
    >
      <Icon name="warning" className="size-4.5 text-bad-text" strokeWidth={1.5} />
      <p className="flex-1 text-sm">{coachErrorMessage(error)}</p>
      {errorNeedsSettings(error) ? (
        <Button variant="secondary" onClick={() => go('settings')}>
          {t('coach.openSettings')}
        </Button>
      ) : (
        <Button variant="secondary" onClick={onRetry} disabled={retryDisabled}>
          {t('coach.retry')}
        </Button>
      )}
    </div>
  )
}
