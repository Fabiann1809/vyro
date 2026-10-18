import { describe, expect, it } from 'vitest'
import { keyboardLayout, KEYBOARD } from './keyboardLayout'

describe('keyboardLayout', () => {
  it('has seven white keys and five black ones, in the order of the octave', () => {
    const { whites, blacks } = keyboardLayout([])

    expect(whites.map((key) => key.note)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
    expect(blacks.map((key) => key.note)).toEqual(['C#', 'D#', 'F#', 'G#', 'A#'])
  })

  it('puts each black key on the line after its white key, and none after E or B', () => {
    const { whites, blacks } = keyboardLayout([])
    const line = (note: string): number => {
      const key = whites.find((white) => white.note === note)
      return (key?.x ?? 0) + KEYBOARD.whiteWidth
    }
    const centre = (note: string): number => {
      const key = blacks.find((black) => black.note === note)
      return (key?.x ?? 0) + KEYBOARD.blackWidth / 2
    }

    expect(centre('C#')).toBe(line('C'))
    expect(centre('D#')).toBe(line('D'))
    expect(centre('F#')).toBe(line('F'))
    expect(centre('G#')).toBe(line('G'))
    expect(centre('A#')).toBe(line('A'))
  })

  it('lights exactly the notes it is given', () => {
    const { whites, blacks } = keyboardLayout(['C', 'E', 'G', 'A#'])

    expect([...whites, ...blacks].filter((key) => key.lit).map((key) => key.note)).toEqual([
      'C',
      'E',
      'G',
      'A#'
    ])
  })
})
