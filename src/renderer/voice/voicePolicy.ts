import type { FeedbackMessage } from '@renderer/engine/feedback'
import { localize, t, type Language, type MessageKey } from '@renderer/i18n'
import { praiseClipId, ruleClipId } from './clipList'
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

// Only what matters is spoken. Small details stay on the screen, where they cost no attention.
function isImportant(message: FeedbackMessage): boolean {
  return message.kind === 'praise' || message.severity !== 'low'
}

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
    if (!settings.enabled || !isImportant(message)) return false

    const identity = identityOf(message)
    const last = this.lastSpokenAt.get(identity)
    if (last !== undefined && nowMs - last < this.options.repeatMs) return false

    // Never talk over the voice. A safety alert about the movement in progress is the only
    // thing worth interrupting for, and the one the user needs to hear right now.
    const urgent = message.kind === 'correction' && message.live && message.severity === 'high'
    if (this.talker.isSpeaking() && !urgent) return false

    const spoken = this.talker.say(this.spokenForm(message), settings)
    if (spoken === 'silent') return false

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
