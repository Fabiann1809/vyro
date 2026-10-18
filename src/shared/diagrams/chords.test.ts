import { describe, expect, it } from 'vitest'
import { CHORD_NAMES, CHORDS, type ChordName } from './chords'

// Standard tuning, lowest string first, as MIDI numbers (E2 A2 D3 G3 B3 E4).
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const QUALITY = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7]
} as const

// What a name means, written from music theory and not from the fingerings: the root and the
// notes that make the chord.
function expectedNotes(name: ChordName): { root: number; notes: number[] } {
  const letter = name[0] as keyof typeof NOTE
  const quality = name.slice(1) as keyof typeof QUALITY
  const root = NOTE[letter]
  return { root, notes: QUALITY[quality].map((interval) => (root + interval) % 12).sort() }
}

const played = (name: ChordName): Array<{ string: number; fret: number; pitch: number }> =>
  CHORDS[name].frets.flatMap((fret, index) =>
    fret === null ? [] : [{ string: 6 - index, fret, pitch: (OPEN_STRINGS[index] ?? 0) + fret }]
  )

describe.each(CHORD_NAMES)('chord %s', (name) => {
  const shape = CHORDS[name]

  it('plays the notes of the chord and no other, with the root in the bass', () => {
    const sounding = played(name)
    const { root, notes } = expectedNotes(name)
    const heard = new Set(sounding.map((item) => item.pitch % 12))

    // Every note it plays belongs to the chord.
    for (const pitchClass of heard) expect(notes).toContain(pitchClass)
    // A four-note chord may leave out its fifth, as the usual C7 does; nothing else may be missing.
    const needed = notes.length === 4 ? notes.filter((note) => note !== (root + 7) % 12) : notes
    for (const pitchClass of needed) expect(heard).toContain(pitchClass)
    expect((sounding[0]?.pitch ?? -1) % 12).toBe(root)
  })

  it('has a finger on every pressed string and on no other', () => {
    shape.frets.forEach((fret, index) => {
      const pressed = fret !== null && fret > 0
      expect(shape.fingers[index] !== null).toBe(pressed)
    })
  })

  it('keeps a finger on one fret, and every shape inside a hand', () => {
    const fretsOfFinger = new Map<number, Set<number>>()
    shape.fingers.forEach((finger, index) => {
      const fret = shape.frets[index]
      if (finger === null || fret === null || fret === undefined) return
      fretsOfFinger.set(finger, (fretsOfFinger.get(finger) ?? new Set()).add(fret))
    })
    for (const frets of fretsOfFinger.values()) expect(frets.size).toBe(1)

    const pressed = shape.frets.filter((fret): fret is number => fret !== null && fret > 0)
    expect(Math.max(...pressed) - Math.min(...pressed)).toBeLessThanOrEqual(3)
  })

  it('has a barre only where one finger presses the same fret on all its strings', () => {
    if (!shape.barre) return
    const { fret, finger, fromString, toString } = shape.barre
    expect(fromString).toBeGreaterThan(toString)
    for (let string = fromString; string >= toString; string--) {
      const index = 6 - string
      // Strings under the barre are pressed at its fret or by another finger higher up.
      expect(shape.frets[index]).toBeGreaterThanOrEqual(fret)
    }
    expect(shape.fingers.filter((item) => item === finger).length).toBeGreaterThanOrEqual(2)
    expect(shape.frets[6 - fromString]).toBe(fret)
    expect(shape.frets[6 - toString]).toBe(fret)
  })
})
