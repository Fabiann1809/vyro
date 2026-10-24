// Where to put round bubbles of different sizes in a box so that none overlaps another: the biggest
// goes to the middle and each next one is set as near the middle as it can be.
export interface PlacedBubble {
  // The centre and the radius, in the units of the box.
  x: number
  y: number
  r: number
}

const GAP = 6

const overlaps = (a: PlacedBubble, b: PlacedBubble): boolean =>
  Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + GAP

const fits = (bubble: PlacedBubble, width: number, height: number): boolean =>
  bubble.x - bubble.r >= 0 &&
  bubble.x + bubble.r <= width &&
  bubble.y - bubble.r >= 0 &&
  bubble.y + bubble.r <= height

// `diameters` in the order they should be placed (the biggest first). A bubble that finds no room
// is made smaller until it does, so every one gets a place.
export function packBubbles(
  diameters: readonly number[],
  width: number,
  height: number
): PlacedBubble[] {
  const placed: PlacedBubble[] = []
  const centre = { x: width / 2, y: height / 2 }

  for (const diameter of diameters) {
    let radius = diameter / 2
    let found: PlacedBubble | null = null

    while (!found && radius > 8) {
      // Rings of growing size around the middle, looking all the way round on each.
      for (let ring = 0; ring <= Math.max(width, height) && !found; ring += 6) {
        const steps = ring === 0 ? 1 : Math.max(12, Math.round((2 * Math.PI * ring) / 8))
        for (let step = 0; step < steps && !found; step++) {
          const angle = (step / steps) * 2 * Math.PI - Math.PI / 2
          const candidate = {
            x: centre.x + Math.cos(angle) * ring * (width / height),
            y: centre.y + Math.sin(angle) * ring,
            r: radius
          }
          if (
            fits(candidate, width, height) &&
            !placed.some((other) => overlaps(candidate, other))
          ) {
            found = candidate
          }
        }
      }
      if (!found) radius -= 4
    }
    placed.push(found ?? { x: centre.x, y: centre.y, r: 8 })
  }
  return placed
}

// The size of a bubble for a count: the most frequent is the biggest, between `min` and `max`.
export function bubbleDiameter(count: number, most: number, min = 84, max = 128): number {
  return most <= 0 ? min : Math.round(min + (max - min) * Math.min(1, count / most))
}
