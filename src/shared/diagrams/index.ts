import { z } from 'zod'
import { CHORD_NAMES } from './chords'
import { NOTE_NAMES } from './keys'

// A diagram that a step may show. It is only a name: the drawing comes from a library checked by
// hand (D18), so a model cannot make a fingering up, and a name that is not there is rejected.

export const MAX_DIAGRAMS = 4

export const diagramRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chord'), name: z.enum(CHORD_NAMES) }).strict(),
  z
    .object({
      kind: z.literal('keys'),
      // The keys to light, each note once.
      notes: z
        .array(z.enum(NOTE_NAMES))
        .min(1)
        .max(NOTE_NAMES.length)
        .refine((notes) => new Set(notes).size === notes.length, 'Each note only once.')
    })
    .strict()
])

export type DiagramRef = z.infer<typeof diagramRefSchema>

export { CHORD_NAMES, CHORDS, type ChordName, type ChordShape } from './chords'
export { isBlackKey, NOTE_NAMES, type NoteName } from './keys'
