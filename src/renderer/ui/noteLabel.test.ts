import { describe, expect, it } from 'vitest'
import { noteLabel } from './noteLabel'

describe('noteLabel', () => {
  it('names the note and its octave', () => {
    expect(noteLabel('E2')).toEqual({ name: 'Mi', octave: '2' })
    expect(noteLabel('A#3')).toEqual({ name: 'La♯', octave: '3' })
  })

  it('writes a flat as the sharp of the same sound', () => {
    expect(noteLabel('Bb2')).toEqual({ name: 'La♯', octave: '2' })
  })

  it('keeps a text that is not a note', () => {
    expect(noteLabel('hola')).toEqual({ name: 'hola', octave: '' })
  })
})
