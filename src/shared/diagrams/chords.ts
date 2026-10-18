// Guitar chords for the diagrams of a path. They are written by hand and checked by a test that
// works out the notes each shape plays (chords.test.ts): the AI only names one, it never draws it.

export const CHORD_NAMES = [
  'A',
  'Am',
  'A7',
  'Asus2',
  'B7',
  'Bm',
  'C',
  'C7',
  'Cmaj7',
  'D',
  'Dm',
  'D7',
  'Dsus2',
  'Dsus4',
  'E',
  'Em',
  'E7',
  'Em7',
  'F',
  'Fmaj7',
  'G',
  'G7'
] as const

export type ChordName = (typeof CHORD_NAMES)[number]

// A value per string, from the lowest (6th, the thickest) to the highest (1st).
type PerString<T> = readonly [T, T, T, T, T, T]

export interface ChordShape {
  // The fret to press on each string: 0 is an open string, null is a string that is not played.
  frets: PerString<number | null>
  // Which finger presses it: 1 index, 2 middle, 3 ring, 4 little; null if no finger does.
  fingers: PerString<1 | 2 | 3 | 4 | null>
  // A finger laid across several strings, if the shape has one.
  barre?: { fret: number; finger: 1 | 2 | 3 | 4; fromString: number; toString: number }
}

const x = null

export const CHORDS: Record<ChordName, ChordShape> = {
  A: { frets: [x, 0, 2, 2, 2, 0], fingers: [null, null, 1, 2, 3, null] },
  Am: { frets: [x, 0, 2, 2, 1, 0], fingers: [null, null, 2, 3, 1, null] },
  A7: { frets: [x, 0, 2, 0, 2, 0], fingers: [null, null, 2, null, 3, null] },
  Asus2: { frets: [x, 0, 2, 2, 0, 0], fingers: [null, null, 1, 2, null, null] },
  B7: { frets: [x, 2, 1, 2, 0, 2], fingers: [null, 2, 1, 3, null, 4] },
  Bm: {
    frets: [x, 2, 4, 4, 3, 2],
    fingers: [null, 1, 3, 4, 2, 1],
    barre: { fret: 2, finger: 1, fromString: 5, toString: 1 }
  },
  C: { frets: [x, 3, 2, 0, 1, 0], fingers: [null, 3, 2, null, 1, null] },
  C7: { frets: [x, 3, 2, 3, 1, 0], fingers: [null, 3, 2, 4, 1, null] },
  Cmaj7: { frets: [x, 3, 2, 0, 0, 0], fingers: [null, 3, 2, null, null, null] },
  D: { frets: [x, x, 0, 2, 3, 2], fingers: [null, null, null, 1, 3, 2] },
  Dm: { frets: [x, x, 0, 2, 3, 1], fingers: [null, null, null, 2, 3, 1] },
  D7: { frets: [x, x, 0, 2, 1, 2], fingers: [null, null, null, 2, 1, 3] },
  Dsus2: { frets: [x, x, 0, 2, 3, 0], fingers: [null, null, null, 1, 3, null] },
  Dsus4: { frets: [x, x, 0, 2, 3, 3], fingers: [null, null, null, 1, 3, 4] },
  E: { frets: [0, 2, 2, 1, 0, 0], fingers: [null, 2, 3, 1, null, null] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [null, 2, 3, null, null, null] },
  E7: { frets: [0, 2, 0, 1, 0, 0], fingers: [null, 2, null, 1, null, null] },
  Em7: { frets: [0, 2, 0, 0, 0, 0], fingers: [null, 2, null, null, null, null] },
  F: {
    frets: [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    barre: { fret: 1, finger: 1, fromString: 6, toString: 1 }
  },
  Fmaj7: { frets: [x, x, 3, 2, 1, 0], fingers: [null, null, 3, 2, 1, null] },
  G: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, null, null, null, 3] },
  G7: { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, null, null, null, 1] }
}
