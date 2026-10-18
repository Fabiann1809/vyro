// The twelve notes of an octave, with sharps; a keyboard diagram lights some of them. Only the
// names of the notes are given, so the drawing cannot be wrong about which key is which.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export type NoteName = (typeof NOTE_NAMES)[number]

export const isBlackKey = (note: NoteName): boolean => note.endsWith('#')
