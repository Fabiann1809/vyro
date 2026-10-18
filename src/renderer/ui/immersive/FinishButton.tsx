import { FINISH_HOLD_MS, FINISH_ZONE } from '@renderer/core/handControl'
import { t } from '@renderer/i18n'
import { useHandPointer } from '../handPointerStore'

const SIZE = {
  width: `${FINISH_ZONE.width * 100}%`,
  height: `${FINISH_ZONE.height * 100}%`
}

// The only control over the picture: a small button in the top left corner. With the hand control
// on, it is also pressed by pointing a finger at it and holding it; the bar that fills is the time
// left, and the dot is the tip of the finger.
export function FinishButton({
  onFinish,
  withHand
}: {
  onFinish: () => void
  withHand: boolean
}): React.JSX.Element {
  const pointer = useHandPointer((state) => state.pointer)
  const progress = useHandPointer((state) => state.progress)

  return (
    <>
      <button
        type="button"
        onClick={onFinish}
        aria-keyshortcuts="F"
        // The size only matches the zone of the finger when the picture is the one that has the zone.
        style={withHand ? SIZE : undefined}
        className="absolute top-3 left-3 z-10 flex min-h-9 min-w-24 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-black/45 px-4 text-sm font-semibold text-white"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-brand/60"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
        <span className="relative">{t('training.end')}</span>
      </button>
      {withHand && progress > 0 && (
        <span className="sr-only">
          {t('training.hand.hold', { seconds: FINISH_HOLD_MS / 1000 })}
        </span>
      )}
      {withHand && pointer && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute z-20 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand"
          style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }}
        />
      )}
    </>
  )
}
