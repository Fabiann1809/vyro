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
  const color = praise || !channel ? 'var(--good)' : CHANNEL_LOOK[channel].color

  return (
    <div
      className="anim-up absolute right-6 bottom-6 left-6 flex items-center gap-5 rounded-[2rem] border-2 bg-[rgba(20,10,14,0.82)] p-4 pr-7"
      style={{
        borderColor: color,
        boxShadow: `0 0 50px color-mix(in oklab, ${color} 40%, transparent)`
      }}
    >
      <span
        aria-hidden="true"
        className="flex size-16 shrink-0 items-center justify-center rounded-full text-[#1a0f0c]"
        style={{ background: color }}
      >
        {praise || !channel ? (
          <span className="text-3xl">★</span>
        ) : (
          <Icon name={CHANNEL_LOOK[channel].icon} className="size-8" strokeWidth={1.7} />
        )}
      </span>
      <p className="text-[2.5rem] leading-tight font-bold tracking-tight text-t1">{text}</p>
    </div>
  )
}
