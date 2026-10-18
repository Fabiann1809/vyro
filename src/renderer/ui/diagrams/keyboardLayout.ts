import { isBlackKey, NOTE_NAMES, type NoteName } from '@shared/diagrams'

// One octave of a piano, as rectangles: the seven white keys and the five black ones over them.

export const KEYBOARD = {
  whiteWidth: 26,
  whiteHeight: 96,
  blackWidth: 16,
  blackHeight: 58,
  margin: 4
} as const

export interface KeyShape {
  note: NoteName
  x: number
  width: number
  height: number
  lit: boolean
}

export interface KeyboardLayout {
  width: number
  height: number
  whites: KeyShape[]
  blacks: KeyShape[]
}

export function keyboardLayout(lit: readonly NoteName[]): KeyboardLayout {
  const { whiteWidth, whiteHeight, blackWidth, blackHeight, margin } = KEYBOARD
  const whites: KeyShape[] = []
  const blacks: KeyShape[] = []

  for (const note of NOTE_NAMES) {
    const isLit = lit.includes(note)
    if (!isBlackKey(note)) {
      whites.push({
        note,
        x: margin + whites.length * whiteWidth,
        width: whiteWidth,
        height: whiteHeight,
        lit: isLit
      })
    } else {
      // A black key sits on the line between the white key before it and the next one.
      blacks.push({
        note,
        x: margin + whites.length * whiteWidth - blackWidth / 2,
        width: blackWidth,
        height: blackHeight,
        lit: isLit
      })
    }
  }

  return {
    width: margin * 2 + whites.length * whiteWidth,
    height: whiteHeight + margin * 2,
    whites,
    blacks
  }
}
