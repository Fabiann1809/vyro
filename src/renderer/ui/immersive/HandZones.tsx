import { HOLD_MS, ZONE_WIDTH, type HandAction } from '@renderer/core/handControl'
import { t } from '@renderer/i18n'
import { Icon } from '../kit/Icon'
import { useHandPointer } from '../handPointerStore'

const PERCENT = ZONE_WIDTH * 100

interface ZoneProps {
  action: HandAction
  label: string
  side: 'left' | 'right'
  progress: number
  onPress: () => void
}

// One of the two zones at the sides of the picture. It is also a button, for the mouse and the
// keyboard. The bar that fills is the time left to hold the finger there.
function Zone({ action, label, side, progress, onPress }: ZoneProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onPress}
      data-hand-zone={action}
      style={{ width: `${PERCENT}%` }}
      className={`absolute inset-y-0 z-10 flex flex-col items-center justify-center gap-3 overflow-hidden border-white/25 bg-black/35 px-3 text-center ${
        side === 'left' ? 'left-0 border-r-2' : 'right-0 border-l-2'
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 bg-brand/55"
        style={{ height: `${Math.round(progress * 100)}%` }}
      />
      <span className="relative flex flex-col items-center gap-2">
        <Icon name="hands" className="size-9" strokeWidth={1.4} />
        <span className="text-2xl font-semibold">{label}</span>
        <span className="text-sm text-t4">
          {t('training.hand.hold', { seconds: HOLD_MS[action] / 1000 })}
        </span>
      </span>
    </button>
  )
}

// Pausing and finishing from where the person stands: point a finger at a side of the picture and
// hold it. The dot is the tip of the finger.
export function HandZones({
  paused,
  onPause,
  onFinish
}: {
  paused: boolean
  onPause: () => void
  onFinish: () => void
}): React.JSX.Element {
  const pointer = useHandPointer((state) => state.pointer)
  const progress = useHandPointer((state) => state.progress)

  return (
    <>
      <Zone
        action="pause"
        label={paused ? t('training.resume') : t('training.pause')}
        side="left"
        progress={progress.pause}
        onPress={onPause}
      />
      <Zone
        action="finish"
        label={t('training.end')}
        side="right"
        progress={progress.finish}
        onPress={onFinish}
      />
      {pointer && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute z-20 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand"
          style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }}
        />
      )}
    </>
  )
}
