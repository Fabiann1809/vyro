import { describe, expect, it } from 'vitest'
import { clickTrack, seededNoise, silence } from '@renderer/core/audio/syntheticSound'
import { replaySound } from '@renderer/engine/audioReplay'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import beatConfig from './steady-beat.json'

const beat: SkillConfig = (() => {
  const parsed = parseSkillConfig(beatConfig)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

// Targets of the spec: how often reps are counted and how often their errors are named.
const MIN_COUNT_ACCURACY = 0.9
const MIN_ERROR_ACCURACY = 0.8

const NOTES = 10
// The pace is only known from the third note, so the first ones have nothing to be judged by.
const UNJUDGED = 3

function play(bpm: number, options: { jitterMs?: number } = {}): ReturnType<typeof replaySound> {
  return replaySound(beat, clickTrack(bpm, NOTES, options))
}

const failures = (session: ReturnType<typeof replaySound>): string[][] =>
  session.repResults.map((result) => result.failed.map((outcome) => outcome.ruleId))

describe('steady beat', () => {
  it('only listens: it needs no camera', () => {
    expect(beat.camera).toBeUndefined()
    expect(beat.metrics['pace']).toMatchObject({ type: 'tempo' })
  })

  it('counts every note of a set', () => {
    expect(play(80).repCount).toBeGreaterThanOrEqual(NOTES - 1)
  })

  it('has nothing to correct in a beat that holds the pace', () => {
    expect(failures(play(80)).every((failed) => failed.length === 0)).toBe(true)
  })

  it('allows a player who is a little uneven', () => {
    expect(failures(play(80, { jitterMs: 25 })).every((failed) => failed.length === 0)).toBe(true)
  })

  it('catches a player who rushes, from the notes where the pace is known', () => {
    const judged = failures(play(105)).slice(UNJUDGED)

    expect(judged.length).toBeGreaterThan(3)
    expect(judged.every((failed) => failed.join() === 'too_fast')).toBe(true)
  })

  it('catches a player who drags', () => {
    const judged = failures(play(60)).slice(UNJUDGED)

    expect(judged.length).toBeGreaterThan(3)
    expect(judged.every((failed) => failed.join() === 'too_slow')).toBe(true)
  })

  it('does not count a room with nobody playing', () => {
    expect(replaySound(beat, silence(5)).repCount).toBe(0)
  })
})

describe('accuracy of the steady beat', () => {
  const random = seededNoise(97)
  const between = (low: number, high: number): number => low + ((high - low) * (random() + 1)) / 2

  const runs = [
    ...Array.from({ length: 10 }, () => ({ bpm: between(77, 83), expected: [] as string[] })),
    ...Array.from({ length: 5 }, () => ({ bpm: between(100, 125), expected: ['too_fast'] })),
    ...Array.from({ length: 5 }, () => ({ bpm: between(52, 64), expected: ['too_slow'] }))
  ].map((run) => ({ ...run, session: play(run.bpm, { jitterMs: 15 }) }))

  it('counts at least 90% of the notes', () => {
    const counted = runs.reduce((sum, run) => sum + Math.min(run.session.repCount, NOTES), 0)

    expect(counted / (runs.length * NOTES)).toBeGreaterThanOrEqual(MIN_COUNT_ACCURACY)
  })

  it('names the mistake of at least 80% of the runs', () => {
    const right = runs.filter((run) => {
      const judged = failures(run.session).slice(UNJUDGED)
      if (judged.length === 0) return false
      if (run.expected.length === 0) return judged.every((failed) => failed.length === 0)
      const named = judged.filter((failed) => run.expected.every((id) => failed.includes(id)))
      return named.length / judged.length >= 0.8
    })

    expect(right.length / runs.length).toBeGreaterThanOrEqual(MIN_ERROR_ACCURACY)
  })

  it('does not raise a false alarm on a beat that holds the pace', () => {
    const goodRuns = runs.filter((run) => run.expected.length === 0)

    expect(
      goodRuns.every((run) => failures(run.session).every((failed) => failed.length === 0))
    ).toBe(true)
  })
})
