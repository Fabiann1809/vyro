import type { MessageKey } from '@renderer/i18n'
import type { SkillChannel } from '@shared/skill/skillChannels'
import type { IconName } from './icons'

// How each channel looks: its name, icon and colour. The same colour is used everywhere the
// channel appears, so that a person learns which is which. Classes are written in full so that
// Tailwind finds them.
interface ChannelLook {
  label: MessageKey
  icon: IconName
  text: string
  tint: string
  fill: string
}

export const CHANNEL_ORDER: readonly SkillChannel[] = ['body', 'hands', 'object', 'audio']

export const CHANNEL_LOOK: Record<SkillChannel, ChannelLook> = {
  body: {
    label: 'channel.body',
    icon: 'body',
    text: 'text-ch-body',
    tint: 'bg-ch-body/14',
    fill: 'bg-ch-body'
  },
  hands: {
    label: 'channel.hands',
    icon: 'hands',
    text: 'text-ch-hands',
    tint: 'bg-ch-hands/14',
    fill: 'bg-ch-hands'
  },
  object: {
    label: 'channel.object',
    icon: 'object',
    text: 'text-ch-object',
    tint: 'bg-ch-object/14',
    fill: 'bg-ch-object'
  },
  audio: {
    label: 'channel.audio',
    icon: 'audio',
    text: 'text-ch-audio',
    tint: 'bg-ch-audio/14',
    fill: 'bg-ch-audio'
  }
}

// The channels of a list in the order the interface always shows them.
export const sortChannels = (channels: readonly SkillChannel[]): SkillChannel[] =>
  CHANNEL_ORDER.filter((channel) => channels.includes(channel))
