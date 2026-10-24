// How the practice screen shows a skill. The texts and the components live in the renderer; the
// skill only picks one of these. A skill that says nothing is counted, as the first skills were.
export const DISPLAYS = ['counter', 'tuner', 'target-note', 'hold', 'beat'] as const
export type Display = (typeof DISPLAYS)[number]

export const DEFAULT_DISPLAY: Display = 'counter'
