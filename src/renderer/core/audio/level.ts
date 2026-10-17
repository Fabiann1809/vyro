// The quietest level that is told apart from silence, in decibels relative to full scale.
export const SILENCE_DB = -100

// Loudness of a piece of sound: the root mean square of its samples, in dBFS (0 is the loudest a
// sample can be, silence is SILENCE_DB).
export function levelDb(samples: Float32Array): number {
  if (samples.length === 0) return SILENCE_DB
  let sum = 0
  for (const sample of samples) sum += sample * sample
  const rms = Math.sqrt(sum / samples.length)
  return rms === 0 ? SILENCE_DB : Math.max(SILENCE_DB, 20 * Math.log10(rms))
}

// The largest sample, 0..1.
export function peakLevel(samples: Float32Array): number {
  let peak = 0
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  return peak
}

// Where a level sits on a meter that goes from `floorDb` (empty) to 0 dB (full), 0..1.
export function meterFraction(db: number, floorDb = -60): number {
  return Math.min(1, Math.max(0, (db - floorDb) / -floorDb))
}
