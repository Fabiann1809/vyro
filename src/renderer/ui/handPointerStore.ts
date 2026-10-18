import { create } from 'zustand'
import type { HandAction } from '@renderer/core/handControl'
import type { Pointer } from '@renderer/core/pointing'

// What the zones of the hand control show: where the finger is and how full each zone is. It is
// updated at the pace of the camera, so only the small part of the screen that reads it redraws.
interface HandPointerState {
  pointer: Pointer | null
  progress: Record<HandAction, number>
  show: (pointer: Pointer | null, progress: Record<HandAction, number>) => void
  clear: () => void
}

const EMPTY = { pointer: null, progress: { pause: 0, finish: 0 } } as const

// Two frames that look the same on screen are not worth drawing twice.
const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.005

export const useHandPointer = create<HandPointerState>((set, get) => ({
  ...EMPTY,
  show: (pointer, progress) => {
    const previous = get()
    const samePointer =
      pointer === previous.pointer ||
      (pointer !== null &&
        previous.pointer !== null &&
        near(pointer.x, previous.pointer.x) &&
        near(pointer.y, previous.pointer.y))
    const sameProgress =
      near(progress.pause, previous.progress.pause) &&
      near(progress.finish, previous.progress.finish)
    if (samePointer && sameProgress) return
    set({ pointer, progress })
  },
  clear: () => set({ ...EMPTY })
}))
