import type { SkillChannel } from '@shared/skill/skillChannels'
import { CHANNEL_LOOK } from '../kit/channels'
import { Icon } from '../kit/Icon'

// The one message of the moment, as a band over the bottom of the picture. A correction takes the
// colour and the icon of what it is about (the body, a hand, the guitar, the sound), a praise is
// green with a star: either way it is also said in words, and read out by the voice. The screen
// keeps the live region it sits in, so that a screen reader announces each one.
export function CorrectionBand({
  text,
  channel,
  praise
}: {
  text: string
  // What the correction is about; null for a praise.
  channel: SkillChannel | null
  praise: boolean
}): React.JSX.Element {
  const fill = praise || !channel ? 'bg-good' : CHANNEL_LOOK[channel].fill

  return (
    <div
      className={`anim-up absolute right-6 bottom-6 left-6 flex items-center gap-4.5 rounded-3xl px-6.5 py-4.5 text-on-brand ${fill}`}
    >
      <span
        aria-hidden="true"
        className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-bg/15"
      >
        {praise || !channel ? (
          <span className="text-3xl">★</span>
        ) : (
          <Icon name={CHANNEL_LOOK[channel].icon} className="size-7" strokeWidth={1.6} />
        )}
      </span>
      <p className="text-[2.375rem] leading-tight font-bold tracking-tight">{text}</p>
    </div>
  )
}
