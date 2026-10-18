import { create } from 'zustand'
import type { Pointer } from '@renderer/core/pointing'

// What the finish button of the hand control shows: where the finger is and how full the button is.
// It is updated at the pace of the camera, so only the small part of the screen that reads it redraws.
interface HandPointerState {
  pointer: Pointer | null
  progress: number
  show: (pointer: Pointer | null, progress: number) => void
  clear: () => void
}

const EMPTY = { pointer: null, progress: 0 } as const

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
    if (samePointer && near(progress, previous.progress)) return
    set({ pointer, progress })
  },
  clear: () => set({ ...EMPTY })
}))
