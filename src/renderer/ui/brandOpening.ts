// The opening of the brand: the mark draws itself once when the app opens. It is not played again
// while the app stays open, and not at all when the person asked for less movement.
let played = false

export function shouldPlayOpening(reduceMotion: boolean): boolean {
  return !played && !reduceMotion
}

export function markOpeningPlayed(): void {
  played = true
}

// For the tests: starts as if the app had just opened.
export function resetOpening(): void {
  played = false
}

// How long the opening lasts, and how long it takes to fade away at the end.
export const OPENING_MS = 1800
export const OPENING_FADE_MS = 400
