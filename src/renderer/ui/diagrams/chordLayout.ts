import { CHORDS, type ChordName } from '@shared/diagrams'

// Where everything goes in a chord chart, as plain numbers, so that the drawing is a list of
// shapes and the geometry can be tested. The chart is read as on a guitar held up: the lowest
// string on the left, the nut on top.

export const CHART = {
  width: 124,
  height: 142,
  left: 22,
  top: 34,
  stringGap: 16,
  fretGap: 20,
  frets: 5,
  strings: 6
} as const

export type StringMark =
  | { type: 'muted'; x: number; y: number }
  | { type: 'open'; x: number; y: number }
  | { type: 'finger'; x: number; y: number; finger: number }

export interface ChordLayout {
  stringXs: number[]
  fretYs: number[]
  marks: StringMark[]
  barre: { x1: number; x2: number; y: number } | null
}

export function chordLayout(name: ChordName): ChordLayout {
  const shape = CHORDS[name]
  const stringXs = Array.from(
    { length: CHART.strings },
    (_, index) => CHART.left + index * CHART.stringGap
  )
  // The lines of the frets, the nut included.
  const fretYs = Array.from(
    { length: CHART.frets + 1 },
    (_, index) => CHART.top + index * CHART.fretGap
  )
  // A finger sits in the middle of its fret, between two lines.
  const fretCentre = (fret: number): number => CHART.top + (fret - 0.5) * CHART.fretGap
  const aboveNut = CHART.top - 12

  const marks = shape.frets.map((fret, index): StringMark => {
    const x = stringXs[index] ?? 0
    if (fret === null) return { type: 'muted', x, y: aboveNut }
    if (fret === 0) return { type: 'open', x, y: aboveNut }
    return { type: 'finger', x, y: fretCentre(fret), finger: shape.fingers[index] ?? 0 }
  })

  // String 6 is the first one on the left, so a string's column is 6 - its number.
  const barre = shape.barre
    ? {
        x1: stringXs[6 - shape.barre.fromString] ?? 0,
        x2: stringXs[6 - shape.barre.toString] ?? 0,
        y: fretCentre(shape.barre.fret)
      }
    : null

  return { stringXs, fretYs, marks, barre }
}
