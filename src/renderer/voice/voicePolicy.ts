import type { FeedbackMessage } from '@renderer/engine/feedback'
import { localize, t, type Language, type MessageKey } from '@renderer/i18n'
import {
  praiseClipId,
  ruleClipId,
  STATUS_NOTICES,
  statusClipId,
  type StatusNotice
} from './clipList'
import type { HowItSounded, SayOptions, SpokenMessage } from './voice'

// The part of Voice the policy needs.
export interface Talker {
  say: (message: SpokenMessage, options: SayOptions) => HowItSounded
  isSpeaking: () => boolean
}

export interface VoiceSettings {
  enabled: boolean
  language: Language
  volume: number
}

export interface VoicePolicyOptions {
  // The same message is not spoken again before this time has passed.
  repeatMs: number
}

const DEFAULT_OPTIONS: VoicePolicyOptions = { repeatMs: 20_000 }

function identityOf(message: FeedbackMessage): string {
  return message.kind === 'praise' ? praiseClipId(message.variant) : message.ruleId
}

// Decides which feedback is spoken, so that the voice stays useful during a whole session:
// only important messages, none repeated too soon, and none cut off by another.
export class VoicePolicy {
  private readonly lastSpokenAt = new Map<string, number>()
  private readonly options: VoicePolicyOptions

  constructor(
    private readonly talker: Talker,
    private readonly skillId: string,
    options: Partial<VoicePolicyOptions> = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // Returns true when the message was spoken.
  consider(message: FeedbackMessage, settings: VoiceSettings, nowMs: number): boolean {
    // A safety alert about the movement in progress is the only thing worth interrupting for, and
    // the one the user needs to hear right now.
    const urgent = message.kind === 'correction' && message.live && message.severity === 'high'
    return this.speak(identityOf(message), this.spokenForm(message), settings, nowMs, urgent)
  }

  // Tells the person the app is not measuring. Subject to the same limits as any other message.
  announce(notice: StatusNotice, settings: VoiceSettings, nowMs: number): boolean {
    const spoken = { clipId: statusClipId(notice), text: t(STATUS_NOTICES[notice]) }
    return this.speak(spoken.clipId, spoken, settings, nowMs, false)
  }

  private speak(
    identity: string,
    message: SpokenMessage,
    settings: VoiceSettings,
    nowMs: number,
    urgent: boolean
  ): boolean {
    if (!settings.enabled) return false

    const last = this.lastSpokenAt.get(identity)
    if (last !== undefined && nowMs - last < this.options.repeatMs) return false

    // Never talk over the voice.
    if (this.talker.isSpeaking() && !urgent) return false

    if (this.talker.say(message, settings) === 'silent') return false

    this.lastSpokenAt.set(identity, nowMs)
    return true
  }

  private spokenForm(message: FeedbackMessage): SpokenMessage {
    if (message.kind === 'praise') {
      return {
        clipId: praiseClipId(message.variant),
        text: t(`training.praise.${message.variant}` as MessageKey)
      }
    }
    return { clipId: ruleClipId(this.skillId, message.ruleId), text: localize(message.message) }
  }
}
