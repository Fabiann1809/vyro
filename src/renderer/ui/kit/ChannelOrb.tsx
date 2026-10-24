import { t } from '@renderer/i18n'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { CHANNEL_LOOK } from './channels'
import { Icon } from './Icon'

// A channel as a round bubble with its icon, in the colour of the channel. The name is for screen
// readers and, for the sighted, a tooltip. With "glow" a light spreads around it.
export function ChannelOrb({
  channel,
  size = 'size-8',
  glow = false
}: {
  channel: SkillChannel
  size?: string
  glow?: boolean
}): React.JSX.Element {
  const look = CHANNEL_LOOK[channel]
  return (
    <span
      role="img"
      aria-label={t(look.label)}
      title={t(look.label)}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${size} ${look.tint} ${look.text} ${glow ? 'shadow-[0_0_28px_color-mix(in_oklab,currentColor_35%,transparent)]' : ''}`}
    >
      <Icon name={look.icon} className="size-[52%]" strokeWidth={1.6} />
    </span>
  )
}
