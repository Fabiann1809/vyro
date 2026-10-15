import type { RepResult, RuleOutcome } from './repEvaluator'
import type { Severity } from './skillSchema'

export type FeedbackMessage =
  | {
      kind: 'correction'
      ruleId: string
      severity: Severity
      message: { es: string; en: string }
      // True for a safety alert raised while moving, false for a correction after a repetition.
      live: boolean
    }
  // The text of a praise lives in the translation files; `variant` picks which one to show.
  | { kind: 'praise'; variant: number }

// A live rule that is failing right now, reported frame by frame.
export interface LiveAlert {
  ruleId: string
  severity: Severity
  message: { es: string; en: string }
}

export interface FeedbackOptions {
  // Minimum time between two messages.
  cooldownMs: number
  // Praise after this many good repetitions in a row.
  praiseEvery: number
  // How many different praises exist in the translation files.
  praiseVariants: number
  // A live alert must fail for this many consecutive frames before it is raised.
  livePersistFrames: number
}

const DEFAULT_OPTIONS: FeedbackOptions = {
  cooldownMs: 3000,
  praiseEvery: 3,
  praiseVariants: 3,
  livePersistFrames: 5
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

function bySeverity<T extends { severity: Severity }>(items: readonly T[]): T[] {
  // Array.prototype.sort is stable, so equal severities keep the order of the skill.
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

// Decides what to tell the user and when, so the screen and the voice never get crowded:
// one message at a time, the most severe first, and a pause between messages.
export class FeedbackPrioritizer {
  private readonly options: FeedbackOptions
  private lastMessageAt = -Infinity
  private lastWasLive = false
  private goodStreak = 0
  private readonly liveFrames = new Map<string, number>()

  constructor(options: Partial<FeedbackOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // Call once for every finished repetition.
  onRepResult(result: RepResult, nowMs: number): FeedbackMessage | null {
    // Nothing could be judged, so there is nothing to say and the streak is left alone.
    if (result.quality === 'unknown') return null

    const worst = bySeverity(result.failed)[0]
    if (worst) {
      this.goodStreak = 0
      return this.emit(this.correctionOf(worst, false), nowMs)
    }

    this.goodStreak++
    if (this.goodStreak % this.options.praiseEvery !== 0) return null

    const variant = (this.goodStreak / this.options.praiseEvery - 1) % this.options.praiseVariants
    return this.emit({ kind: 'praise', variant }, nowMs)
  }

  // Call on every frame with the live rules that are failing at that moment (empty if none).
  onLiveFrame(alerts: readonly LiveAlert[], nowMs: number): FeedbackMessage | null {
    const failingNow = new Set(alerts.map((alert) => alert.ruleId))
    for (const ruleId of [...this.liveFrames.keys()]) {
      if (!failingNow.has(ruleId)) this.liveFrames.delete(ruleId)
    }
    for (const ruleId of failingNow) {
      this.liveFrames.set(ruleId, (this.liveFrames.get(ruleId) ?? 0) + 1)
    }

    const confirmed = bySeverity(alerts).find(
      (alert) => (this.liveFrames.get(alert.ruleId) ?? 0) >= this.options.livePersistFrames
    )
    if (!confirmed) return null

    // A safety alert may interrupt the pause that follows a correction, but not repeat itself.
    const mayInterrupt = !this.lastWasLive
    if (!mayInterrupt && !this.cooldownOver(nowMs)) return null

    return this.emit({ ...this.correctionOf(confirmed, true) }, nowMs, true)
  }

  reset(): void {
    this.lastMessageAt = -Infinity
    this.lastWasLive = false
    this.goodStreak = 0
    this.liveFrames.clear()
  }

  private correctionOf(source: RuleOutcome | LiveAlert, live: boolean): FeedbackMessage {
    return {
      kind: 'correction',
      ruleId: source.ruleId,
      severity: source.severity,
      message: source.message,
      live
    }
  }

  private cooldownOver(nowMs: number): boolean {
    return nowMs - this.lastMessageAt >= this.options.cooldownMs
  }

  // A message that arrives during the pause is dropped, not queued: by the time the pause ends
  // it would be about a repetition that is already in the past.
  private emit(message: FeedbackMessage, nowMs: number, force = false): FeedbackMessage | null {
    if (!force && !this.cooldownOver(nowMs)) return null

    this.lastMessageAt = nowMs
    this.lastWasLive = message.kind === 'correction' && message.live
    return message
  }
}
