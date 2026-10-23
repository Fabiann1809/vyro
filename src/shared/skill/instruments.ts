// The instruments VYRO can tell by their sound (D19). A skill that listens to one names one of
// these; each is a group of the classes of the audio model (YAMNet, AudioSet names).
export const INSTRUMENTS = [
  'guitar',
  'bass',
  'ukulele',
  'piano',
  'flute',
  'violin',
  'saxophone',
  'trumpet',
  'clarinet',
  'harmonica',
  'drums',
  'voice'
] as const

export type InstrumentName = (typeof INSTRUMENTS)[number]

export const INSTRUMENT_CLASSES: Record<InstrumentName, readonly string[]> = {
  guitar: ['Guitar', 'Electric guitar', 'Acoustic guitar', 'Steel guitar, slide guitar'],
  bass: ['Bass guitar'],
  ukulele: ['Ukulele'],
  piano: ['Piano', 'Electric piano', 'Keyboard (musical)'],
  flute: ['Flute'],
  violin: ['Violin, fiddle'],
  saxophone: ['Saxophone'],
  trumpet: ['Trumpet'],
  clarinet: ['Clarinet'],
  harmonica: ['Harmonica'],
  drums: ['Drum kit', 'Drum', 'Snare drum', 'Bass drum'],
  // Sung notes are often heard as speech.
  voice: ['Singing', 'Child singing', 'Speech']
}
