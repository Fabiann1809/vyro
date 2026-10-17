export type Quality = 'good' | 'warn' | 'bad'

// The fill of each quality. Never colour alone: the so-so and the bad ones are also striped.
export const QUALITY_FILL: Record<Quality, string> = {
  good: 'bg-good',
  warn: 'pattern-warn',
  bad: 'pattern-bad'
}
