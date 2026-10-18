import { DwellTracker, type DwellTarget } from './dwell'
import type { HandObservation } from './handFrame'
import { pointerOf, type Pointer } from './pointing'

// Finishing a training from a distance: a small button in a corner of the picture, pressed by
// pointing a finger at it and holding it. The corner is given as the person sees the picture, which
// is mirrored, so it is the top left of the screen.

// Finishing keeps what was done and leaves the screen, so it asks for a long hold.
export const FINISH_HOLD_MS = 2000

// The size of the button, as a part of the picture. The screen draws the button with these.
export const FINISH_ZONE = { width: 0.14, height: 0.12 } as const

const FINISH: DwellTarget = {
  id: 'finish',
  rect: { x0: 0, y0: 0, x1: FINISH_ZONE.width, y1: FINISH_ZONE.height },
  holdMs: FINISH_HOLD_MS
}

export interface HandControlState {
  // The finger that points, in 0..1 of the picture as the person sees it (mirrored); null if none.
  pointer: Pointer | null
  // How far the button is from being pressed, 0..1.
  progress: number
  // True once, when the button has just been pressed.
  finished: boolean
}

export class HandControl {
  private readonly tracker = new DwellTracker([FINISH])

  update(hands: readonly HandObservation[], nowMs: number): HandControlState {
    const found = hands.map((hand) => pointerOf(hand.landmarks)).find((pointer) => pointer !== null)
    // The picture is mirrored for the person, and the model sees it as the camera does.
    const pointer = found ? { x: 1 - found.x, y: found.y } : null

    const { progress, fired } = this.tracker.update(pointer, nowMs)
    return { pointer, progress: progress['finish'] ?? 0, finished: fired === 'finish' }
  }

  reset(): void {
    this.tracker.reset()
  }
}
