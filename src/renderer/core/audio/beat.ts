// What the pulse meter says about the pace of the last notes, against the pace asked for.

// Within this share of the pace asked for, the beat counts as steady (80 beats per minute: 72 to 88).
export const STEADY_SHARE = 0.1

export type BeatStatus = 'silent' | 'slow' | 'steady' | 'fast'

// `bpm` is the pace heard (null until a few beats have been struck).
export function beatStatus(bpm: number | null, targetBpm: number): BeatStatus {
  if (bpm === null) return 'silent'
  if (bpm < targetBpm * (1 - STEADY_SHARE)) return 'slow'
  if (bpm > targetBpm * (1 + STEADY_SHARE)) return 'fast'
  return 'steady'
}

// How far the pace is from the one asked for, as a share of it: -1 is half the pace, 1 is double.
// Limited to -0.5..0.5 so a wild reading cannot push a needle off its scale.
export const beatOffset = (bpm: number, targetBpm: number): number =>
  Math.max(-0.5, Math.min(0.5, bpm / targetBpm - 1))
