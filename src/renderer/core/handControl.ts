import { DwellTracker, type DwellTarget } from './dwell'
import type { HandObservation } from './handFrame'
import { pointerOf, type Pointer } from './pointing'

// Pausing and finishing a training from a distance: two zones at the sides of the picture, pressed by
// pointing a finger at them and holding it. The zones are given as the person sees the picture,
// which is mirrored, so the left one is the one on their left hand's side of the screen.

export type HandAction = 'pause' | 'finish'

export const ZONE_WIDTH = 0.22

// Finishing keeps what was done and leaves the screen, so it asks for a longer hold than pausing.
export const HOLD_MS: Record<HandAction, number> = { pause: 1000, finish: 2000 }

const TARGETS: DwellTarget[] = [
  { id: 'pause', rect: { x0: 0, y0: 0, x1: ZONE_WIDTH, y1: 1 }, holdMs: HOLD_MS.pause },
  { id: 'finish', rect: { x0: 1 - ZONE_WIDTH, y0: 0, x1: 1, y1: 1 }, holdMs: HOLD_MS.finish }
]

export interface HandControlState {
  // The finger that points, in 0..1 of the picture as the person sees it (mirrored); null if none.
  pointer: Pointer | null
  // How far each zone is from being pressed, 0..1.
  progress: Record<HandAction, number>
  // The zone that has just been pressed, once.
  fired: HandAction | null
}

export class HandControl {
  private readonly tracker = new DwellTracker(TARGETS)

  update(hands: readonly HandObservation[], nowMs: number): HandControlState {
    const found = hands.map((hand) => pointerOf(hand.landmarks)).find((pointer) => pointer !== null)
    // The picture is mirrored for the person, and the model sees it as the camera does.
    const pointer = found ? { x: 1 - found.x, y: found.y } : null

    const { progress, fired } = this.tracker.update(pointer, nowMs)
    return {
      pointer,
      progress: { pause: progress['pause'] ?? 0, finish: progress['finish'] ?? 0 },
      fired: fired === 'pause' || fired === 'finish' ? fired : null
    }
  }

  reset(): void {
    this.tracker.reset()
  }
}
