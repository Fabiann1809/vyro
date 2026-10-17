import { t } from '@renderer/i18n'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { CHANNEL_LOOK } from './channels'
import { Icon } from './Icon'

// A channel as a small pill: icon and name, so it never depends on the colour alone.
export function ChannelChip({ channel }: { channel: SkillChannel }): React.JSX.Element {
  const look = CHANNEL_LOOK[channel]
  return (
    <span
      className={`inline-flex h-6.5 items-center gap-1.5 rounded-full pr-2.5 pl-2 text-xs font-medium ${look.tint} ${look.text}`}
    >
      <Icon name={look.icon} className="size-3.5" strokeWidth={1.5} />
      {t(look.label)}
    </span>
  )
}

// Only the icon, for a list where the name would not fit; the name stays for screen readers.
export function ChannelMark({
  channel,
  className = 'size-4'
}: {
  channel: SkillChannel
  className?: string
}): React.JSX.Element {
  const look = CHANNEL_LOOK[channel]
  return (
    <span className={`inline-flex ${look.text}`} role="img" aria-label={t(look.label)}>
      <Icon name={look.icon} className={className} strokeWidth={1.5} />
    </span>
  )
}

export function ChannelChips({
  channels
}: {
  channels: readonly SkillChannel[]
}): React.JSX.Element {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {channels.map((channel) => (
        <li key={channel}>
          <ChannelChip channel={channel} />
        </li>
      ))}
    </ul>
  )
}
