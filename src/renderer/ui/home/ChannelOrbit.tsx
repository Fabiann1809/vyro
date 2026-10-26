import { t } from '@renderer/i18n'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { CHANNEL_LOOK, CHANNEL_ORDER } from '../kit/channels'
import { CoachAvatar } from '../kit/CoachAvatar'
import { Icon } from '../kit/Icon'

// Where each channel sits on the ring, as a share of its width and height.
const SPOT: Record<SkillChannel, { x: string; y: string }> = {
  body: { x: '50%', y: '0%' },
  hands: { x: '100%', y: '50%' },
  object: { x: '50%', y: '100%' },
  audio: { x: '0%', y: '50%' }
}

// The picture of the empty home: the coach at the centre and the four ways it measures turning
// slowly around it. The names stay still (the ring turns, each name turns back).
export function ChannelOrbit(): React.JSX.Element {
  return (
    // It is only a picture and, in a narrow window, it reaches over the message box: it takes no clicks.
    <div
      aria-hidden="true"
      className="pointer-events-none relative flex h-125 items-center justify-center"
    >
      <div className="absolute size-110 rounded-full border border-dashed border-line/16" />
      <div className="absolute size-79 rounded-full border border-line/8" />
      <div className="absolute flex size-63 items-center justify-center rounded-full border border-[rgba(255,214,180,0.22)] bg-[radial-gradient(circle_at_50%_40%,oklch(0.7_0.17_45/0.25),transparent_70%)] shadow-[inset_0_0_40px_oklch(0.75_0.16_50/0.18),0_0_80px_oklch(0.65_0.17_40/0.25)] backdrop-blur-xl">
        <CoachAvatar size={190} />
      </div>
      <div className="absolute size-110" style={{ animation: 'vy-spin 70s linear infinite' }}>
        {CHANNEL_ORDER.map((channel) => {
          const look = CHANNEL_LOOK[channel]
          return (
            <div
              key={channel}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: SPOT[channel].x, top: SPOT[channel].y }}
            >
              <div
                className="flex flex-col items-center gap-1.5"
                style={{ animation: 'vy-spin-back 70s linear infinite' }}
              >
                <span
                  className={`flex size-15.5 items-center justify-center rounded-full border border-current/40 bg-(--glass) backdrop-blur-lg ${look.text} shadow-[0_0_34px_color-mix(in_oklab,currentColor_30%,transparent)]`}
                >
                  <Icon name={look.icon} className="size-6.5" strokeWidth={1.6} />
                </span>
                <span className="rounded-full bg-sunk px-2.5 py-0.75 text-xs font-semibold text-t2">
                  {t(look.label)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div
        className="absolute top-[12%] right-[4%] flex h-9.5 items-center gap-2 rounded-full border border-line/12 bg-(--glass) px-3.5 text-[0.8125rem] text-t2 backdrop-blur-lg"
        style={{ animation: 'vy-float 5s ease-in-out infinite' }}
      >
        <span className="flex h-3.5 items-center gap-0.5">
          {[6, 12, 8].map((height, index) => (
            <span
              key={index}
              className="w-0.75 rounded-xs bg-accent"
              style={{ height, animation: `vy-dot 1.1s ${index * 0.15}s infinite` }}
            />
          ))}
        </span>
        {t('home.channelsReady')}
      </div>
    </div>
  )
}
