import { frequencyOfMidi, nearestNote, noteToMidi } from '@renderer/core/audio/pitch'
import { t, type MessageKey } from '@renderer/i18n'

const NOTE_TEXT: Record<string, MessageKey> = {
  C: 'note.C',
  'C#': 'note.C#',
  D: 'note.D',
  'D#': 'note.D#',
  E: 'note.E',
  F: 'note.F',
  'F#': 'note.F#',
  G: 'note.G',
  'G#': 'note.G#',
  A: 'note.A',
  'A#': 'note.A#',
  B: 'note.B'
}

export interface NoteLabel {
  // In the language of the person: "Mi", "La♯", "E".
  name: string
  // The octave, which tells apart the low E string from the high one.
  octave: string
}

// "E2" as the person reads it. A flat ("Bb2") is written as its sharp, which is the same sound.
export function noteLabel(note: string): NoteLabel {
  const midi = noteToMidi(note)
  const sharp = midi === null ? note : nearestNote(frequencyOfMidi(midi)).name
  const match = /^([A-G]#?)(-?\d)$/.exec(sharp)
  const key = match?.[1] ? NOTE_TEXT[match[1]] : undefined
  return key && match?.[2] ? { name: t(key), octave: match[2] } : { name: note, octave: '' }
}
