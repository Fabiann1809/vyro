import { IN_TUNE_HOLD_MS } from '@renderer/core/audio/tuning'
import type { RepResult, RuleOutcome } from './repEvaluator'

// Tuning a string is a loop: pluck it, turn the peg, pluck it again. The plucks on the way are out
// of tune by nature, so judging each one would punish the person for tuning. What says how it went
// is where each string ended: tuned, or not.
//
// Each string that was tried counts once. A string that was tuned counts as good, however many
// plucks it took; one that was left untuned counts as its last pluck was judged. The rules that
// failed on the way stay listed, once per string, so the summary still says what to correct.
export function settleTuning(
  byString: ReadonlyMap<number, readonly RepResult[]>,
  tuned: ReadonlySet<number>
): RepResult[] {
  const settled: RepResult[] = []

  for (const [string, attempts] of byString) {
    const isTuned = tuned.has(string)
    if (attempts.length === 0 && !isTuned) continue

    const judged = attempts.filter((attempt) => attempt.quality !== 'unknown')
    const last = judged[judged.length - 1] ?? attempts[attempts.length - 1]
    const repIndex = settled.length + 1

    if (!isTuned && last) {
      settled.push({ ...last, repIndex })
      continue
    }
    settled.push({
      repIndex,
      quality: 'good',
      // The string had to ring in tune for this long to count as tuned.
      durationMs: last?.durationMs ?? IN_TUNE_HOLD_MS,
      outcomes: last?.outcomes ?? [],
      failed: failedOnce(attempts)
    })
  }

  return settled
}

// The rules that failed in any pluck, each once, in the order they first failed.
function failedOnce(attempts: readonly RepResult[]): RuleOutcome[] {
  const seen = new Map<string, RuleOutcome>()
  for (const outcome of attempts.flatMap((attempt) => attempt.failed)) {
    if (!seen.has(outcome.ruleId)) seen.set(outcome.ruleId, outcome)
  }
  return [...seen.values()]
}
