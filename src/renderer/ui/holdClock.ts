// How long the person has been in position without a break, for a skill that is held. It is told the
// phase of every frame and answers with the milliseconds since the position was taken, or null
// while they are out of it.
export class HoldClock {
  private since: number | null = null

  update(phase: string | null, inPosition: string, timestampMs: number): number | null {
    if (phase !== inPosition) {
      this.since = null
      return null
    }
    this.since ??= timestampMs
    return timestampMs - this.since
  }
}
