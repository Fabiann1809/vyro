import { describe, expect, it } from 'vitest'
import {
  pluck,
  seededNoise,
  sequence,
  silence,
  addNoise
} from '@renderer/core/audio/syntheticSound'
import { replaySound } from '@renderer/engine/audioReplay'
import { retarget } from '@renderer/engine/retarget'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import tuningConfig from './string-tuning.json'

const tuning: SkillConfig = (() => {
  const parsed = parseSkillConfig(tuningConfig)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

// Targets of the spec: how often reps are counted and how often their errors are named.
const MIN_COUNT_ACCURACY = 0.9
const MIN_ERROR_ACCURACY = 0.8

// The open strings of a guitar.
const STRINGS = [82.41, 110, 146.83, 196, 246.94, 329.63]

const detuned = (hz: number, cents: number): number => hz * 2 ** (cents / 1200)

// A pluck on its own, with a little quiet before and after.
const play = (
  hz: number,
  options: { decaySeconds?: number; seconds?: number } = {}
): Float32Array =>
  sequence(
    silence(0.6),
    pluck(hz, options.seconds ?? 4, { decaySeconds: options.decaySeconds ?? 0.9 }),
    silence(0.8)
  )

function judge(signal: Float32Array): { reps: number; failed: string[] } {
  const session = replaySound(tuning, signal)
  return {
    reps: session.repCount,
    failed: session.repResults[0]?.failed.map((outcome) => outcome.ruleId) ?? []
  }
}

describe('tune a string', () => {
  it('only listens: it needs no camera', () => {
    expect(tuning.camera).toBeUndefined()
    expect(tuning.metrics['cents']).toMatchObject({ type: 'pitch', target: 'nearest' })
  })

  it('is shown as a tuner, with the six strings of a guitar to choose from', () => {
    expect(tuning.display).toBe('tuner')
    expect(tuning.audio?.targets).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4'])
  })

  it('judges against the string that was chosen, not the nearest note', () => {
    const failed = (target: string, hz: number): string[] => {
      const session = replaySound(retarget(tuning, target), play(hz))
      return session.repResults[0]?.failed.map((outcome) => outcome.ruleId) ?? []
    }

    // A string a little low in tune is still the one meant, even if it is nearer to another note.
    expect(failed('A2', detuned(110, -40))).toEqual(['too_flat'])
    expect(failed('A2', 110)).toEqual([])
    expect(failed('E2', 110)).toEqual(['too_sharp'])
  })

  it('counts a pluck that is in tune, with nothing to correct', () => {
    expect(judge(play(110))).toEqual({ reps: 1, failed: [] })
  })

  it.each(STRINGS)('accepts the string at %s Hz when it is in tune', (hz) => {
    expect(judge(play(hz))).toEqual({ reps: 1, failed: [] })
  })

  it('accepts a string a few cents off, as nobody tunes to the cent', () => {
    expect(judge(play(detuned(196, 6))).failed).toEqual([])
    expect(judge(play(detuned(196, -6))).failed).toEqual([])
  })

  it.each(STRINGS)('catches the string at %s Hz when it is flat', (hz) => {
    expect(judge(play(detuned(hz, -25))).failed).toEqual(['too_flat'])
  })

  it.each(STRINGS)('catches the string at %s Hz when it is sharp', (hz) => {
    expect(judge(play(detuned(hz, 25))).failed).toEqual(['too_sharp'])
  })

  it('catches a pluck that dies away too soon to be heard properly', () => {
    expect(judge(play(110, { decaySeconds: 0.08 })).failed).toContain('let_it_ring')
  })

  it('counts each pluck of a set, and names only the one that is off', () => {
    const set = sequence(
      silence(0.6),
      pluck(110, 3, { decaySeconds: 0.9 }),
      silence(0.8),
      pluck(detuned(146.83, -25), 3, { decaySeconds: 0.9 }),
      silence(0.8),
      pluck(196, 3, { decaySeconds: 0.9 }),
      silence(0.8)
    )
    const session = replaySound(tuning, set)

    expect(session.repCount).toBe(3)
    expect(
      session.repResults.map((result) => result.failed.map((outcome) => outcome.ruleId))
    ).toEqual([[], ['too_flat'], []])
  })

  it('does not count noise in the room as a string', () => {
    const noise = addNoise(silence(5), 0.004, 5)

    expect(replaySound(tuning, noise).repCount).toBe(0)
  })

  it('does not count a room with nobody playing', () => {
    expect(replaySound(tuning, silence(5)).repCount).toBe(0)
  })
})

describe('accuracy of tuning', () => {
  const random = seededNoise(271)
  const between = (low: number, high: number): number => low + ((high - low) * (random() + 1)) / 2
  const string = (): number => STRINGS[Math.floor(((random() + 1) / 2) * STRINGS.length)] ?? 110

  const good = Array.from({ length: 10 }, () => ({
    signal: play(detuned(string(), between(-6, 6))),
    expected: [] as string[]
  }))
  const mistakes: Array<() => { signal: Float32Array; expected: string[] }> = [
    () => ({ signal: play(detuned(string(), -between(15, 35))), expected: ['too_flat'] }),
    () => ({ signal: play(detuned(string(), between(15, 35))), expected: ['too_sharp'] }),
    () => ({ signal: play(string(), { decaySeconds: 0.08 }), expected: ['let_it_ring'] })
  ]
  const bad = Array.from({ length: 10 }, (_, index) => mistakes[index % mistakes.length]?.())
  const all = [...good, ...bad].flatMap((item) => (item ? [item] : []))

  const results = all.map(({ signal, expected }) => {
    const { reps, failed } = judge(signal)
    const named = expected.every((id) => failed.includes(id))
    const noFalseAlarm = expected.length > 0 || failed.length === 0
    return { counted: reps === 1, right: reps === 1 && named && noFalseAlarm }
  })

  it('counts at least 90% of the plucks', () => {
    expect(
      results.filter((result) => result.counted).length / results.length
    ).toBeGreaterThanOrEqual(MIN_COUNT_ACCURACY)
  })

  it('names the mistake of at least 80% of the plucks', () => {
    expect(results.filter((result) => result.right).length / results.length).toBeGreaterThanOrEqual(
      MIN_ERROR_ACCURACY
    )
  })

  it('does not raise a false alarm on a string that is in tune', () => {
    expect(results.slice(0, good.length).every((result) => result.right)).toBe(true)
  })
})
