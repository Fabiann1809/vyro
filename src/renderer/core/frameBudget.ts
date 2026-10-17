const DEFAULT_FRAME_BUDGET_MS = 33
const DEFAULT_MAX_SKIPPED = 2
const COST_WEIGHT = 0.3

// Decides, frame by frame, whether there is time for an extra model (hands, an object) on top of
// what already ran. The body comes first: if the frame is nearly spent and this model usually takes
// long, it is skipped (and its last answer reused), but never more than a few frames in a row, so
// the answer does not go stale for long.
export class FrameBudget {
  private cost = 0
  private skipped = 0

  constructor(
    private readonly frameBudgetMs: number = DEFAULT_FRAME_BUDGET_MS,
    private readonly maxSkipped: number = DEFAULT_MAX_SKIPPED
  ) {}

  // `spentMs` is what the models before this one took in the current frame.
  shouldRun(spentMs: number): boolean {
    if (spentMs + this.cost <= this.frameBudgetMs || this.skipped >= this.maxSkipped) {
      this.skipped = 0
      return true
    }
    this.skipped++
    return false
  }

  // The average cost of this model, which gives more weight to the latest frames.
  record(latencyMs: number): void {
    this.cost =
      this.cost === 0 ? latencyMs : this.cost * (1 - COST_WEIGHT) + latencyMs * COST_WEIGHT
  }
}
