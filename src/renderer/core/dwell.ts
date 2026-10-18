import type { Pointer } from './pointing'

// A button that is pressed by holding the pointer on it for a while, as there is no click in the
// air. Pure: it gets the pointer and the time, and says how far each button is and which one fired.

export interface DwellTarget {
  id: string
  // The area of the button, in 0..1 of the picture as the person sees it.
  rect: { x0: number; y0: number; x1: number; y1: number }
  // How long the pointer has to stay on it.
  holdMs: number
}

export interface DwellState {
  // How far each button is from being pressed, 0..1.
  progress: Record<string, number>
  // The button that has just been pressed, once.
  fired: string | null
}

interface Options {
  // The pointer may be lost for this long (a blink of the detector) without starting again.
  graceMs?: number
  // After a press nothing can be pressed for this long, so that one gesture is one press.
  cooldownMs?: number
}

const inside = (target: DwellTarget, pointer: Pointer): boolean =>
  pointer.x >= target.rect.x0 &&
  pointer.x <= target.rect.x1 &&
  pointer.y >= target.rect.y0 &&
  pointer.y <= target.rect.y1

export class DwellTracker {
  private readonly graceMs: number
  private readonly cooldownMs: number
  private activeId: string | null = null
  private since = 0
  private lastOnTarget = 0
  private lastUpdate = 0
  private cooldownUntil = 0

  constructor(
    private readonly targets: readonly DwellTarget[],
    options: Options = {}
  ) {
    this.graceMs = options.graceMs ?? 300
    this.cooldownMs = options.cooldownMs ?? 2000
  }

  update(pointer: Pointer | null, nowMs: number): DwellState {
    const none = Object.fromEntries(this.targets.map((target) => [target.id, 0]))
    const elapsed = nowMs - this.lastUpdate
    this.lastUpdate = nowMs
    if (nowMs < this.cooldownUntil) return { progress: none, fired: null }

    const on = pointer ? (this.targets.find((target) => inside(target, pointer)) ?? null) : null

    if (on) {
      if (this.activeId !== on.id) {
        this.activeId = on.id
        this.since = nowMs
      }
      this.lastOnTarget = nowMs
    } else if (this.activeId !== null) {
      if (nowMs - this.lastOnTarget > this.graceMs) this.activeId = null
      // While the pointer is lost the time does not count, so a button is never pressed from outside.
      else this.since += elapsed
    }

    const active = this.targets.find((target) => target.id === this.activeId)
    if (!active) return { progress: none, fired: null }

    const progress = Math.min(1, (nowMs - this.since) / active.holdMs)
    if (progress < 1) return { progress: { ...none, [active.id]: progress }, fired: null }

    this.activeId = null
    this.cooldownUntil = nowMs + this.cooldownMs
    return { progress: none, fired: active.id }
  }

  reset(): void {
    this.activeId = null
    this.cooldownUntil = 0
  }
}
