import { t, type MessageKey } from '@renderer/i18n'
import type { Channel, OutOfScopeReason } from '@shared/feasibility'

export const REASON_TEXT: Record<OutOfScopeReason, MessageKey> = {
  'invisible-outcome': 'path.reason.invisible-outcome',
  'too-fine-detail': 'path.reason.too-fine-detail',
  'out-of-frame': 'path.reason.out-of-frame',
  'needs-touch': 'path.reason.needs-touch',
  'physical-risk': 'path.reason.physical-risk',
  'no-signal': 'path.reason.no-signal',
  'unsupported-object': 'path.reason.unsupported-object'
}

const CHANNEL_TEXT: Record<Channel, MessageKey> = {
  body: 'path.channel.body',
  hands: 'path.channel.hands',
  audio: 'path.channel.audio',
  object: 'path.channel.object'
}

export const channelList = (channels: readonly Channel[]): string =>
  channels.map((channel) => t(CHANNEL_TEXT[channel])).join(', ')
