import { describe, expect, it } from 'vitest'
import { measureSound, type AudioFeatures } from '@renderer/core/audio/capture'
import { frequencyOfMidi, noteToMidi } from '@renderer/core/audio/pitch'
import { clickTrack, levelSeries, SAMPLE_RATE, tone } from '@renderer/core/audio/syntheticSound'
import { compileExpression } from '@shared/skill/expression'
import { INSTRUMENTS } from '@shared/skill/instruments'
import { skillChannels } from '@shared/skill/skillChannels'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { scoreInstruments } from '@renderer/core/audio/instrument'
import { AudioTracker, type AudioState } from './audioTracker'
import { computeMetrics } from './metrics'

const FRAME = { width: 1280, height: 720 }

// A skill with the given audio metrics and the smallest rest that makes it valid.
function skillWith(
  metrics: Record<string, unknown>,
  extra: Record<string, unknown> = {}
): SkillConfig {
  const first = Object.keys(metrics)[0] ?? 'm'
  const parsed = parseSkillConfig({
    id: 'listening',
    category: 'instrument',
    name: { es: 'Escucha', en: 'Listening' },
    metrics,
    phases: [
      { id: 'a', when: { [first]: { gt: 1 } } },
      { id: 'b', when: { [first]: { lt: 0 } } }
    ],
    rep: { sequence: ['a', 'b', 'a'], minDurationMs: 300 },
    rules: [
      { id: 'r', severity: 'high', check: `min(${first}) > 0`, message: { es: 'x', en: 'x' } }
    ],
    ...extra
  })
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
}

// What the capture would report for a piece of sound, and what the tracker makes of it.
function featuresOf(signal: Float32Array): AudioFeatures {
  return measureSound(signal.subarray(0, 2048), SAMPLE_RATE)
}

function stateOf(signal: Float32Array): AudioState {
  return new AudioTracker().update(0, featuresOf(signal))
}

const measure = (
  skill: SkillConfig,
  audio: AudioState | null,
  a4?: number
): Record<string, number | null> =>
  computeMetrics(skill.metrics, null, null, FRAME, null, audio, a4)

describe('the pitch of the sound', () => {
  const skill = skillWith({
    toA: { type: 'pitch', target: 'A4' },
    toNearest: { type: 'pitch', target: 'nearest' }
  })

  it('is 0 cents for the note it is asked about, played in tune', () => {
    const values = measure(skill, stateOf(tone(440, 0.2)))

    expect(values['toA']).toBeCloseTo(0, 0)
    expect(values['toNearest']).toBeCloseTo(0, 0)
  })

  it('says how far a string is from the note, either way', () => {
    const flat = measure(skill, stateOf(tone(440 * 2 ** (-25 / 1200), 0.2)))
    const sharp = measure(skill, stateOf(tone(440 * 2 ** (30 / 1200), 0.2)))

    expect(flat['toA']).toBeCloseTo(-25, -1)
    expect(sharp['toA']).toBeCloseTo(30, -1)
  })

  it('measures from the note it was asked about, not the nearest', () => {
    // A string at the pitch of A#4 is 100 cents above A4, but in tune for the nearest note.
    const values = measure(skill, stateOf(tone(466.16, 0.2)))

    expect(values['toA']).toBeCloseTo(100, -1)
    expect(Math.abs(values['toNearest'] ?? 99)).toBeLessThan(5)
  })

  it('measures from the nearest note whichever string is tuned', () => {
    const e2 = measure(skill, stateOf(tone(82.41 * 2 ** (12 / 1200), 0.2)))

    expect(e2['toNearest']).toBeCloseTo(12, -1)
  })

  it('follows the tuning of the skill', () => {
    const baroque = skillWith({ toA: { type: 'pitch', target: 'A4' } }, { audio: { a4: 432 } })

    expect(measure(baroque, stateOf(tone(432, 0.2)), 432)['toA']).toBeCloseTo(0, 0)
    expect(baroque.audio?.a4).toBe(432)
  })

  it('is null when there is no pitch to measure', () => {
    const silent = stateOf(new Float32Array(2048))

    expect(measure(skill, silent)).toEqual({ toA: null, toNearest: null })
    expect(measure(skill, null)).toEqual({ toA: null, toNearest: null })
  })
})

describe('the level of the sound', () => {
  const skill = skillWith({ loud: { type: 'level' } })

  it('is the loudness in dBFS, louder for a louder sound', () => {
    const quiet = measure(skill, stateOf(tone(440, 0.2, { amplitude: 0.05 })))['loud'] ?? -100
    const loud = measure(skill, stateOf(tone(440, 0.2, { amplitude: 0.5 })))['loud'] ?? -100

    expect(loud - quiet).toBeCloseTo(20, 0)
    expect(loud).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 1)
  })

  it('is very low for silence', () => {
    expect(measure(skill, stateOf(new Float32Array(2048)))['loud']).toBe(-100)
  })
})

describe('the step between two notes', () => {
  const skill = skillWith({ step: { type: 'interval', semitones: 7 } })

  // Plays a note, a pause, and another, reading the sound as the capture does.
  function play(first: number, second: number): AudioState {
    const tracker = new AudioTracker()
    const note = (hz: number): Float32Array => tone(hz, 0.4)
    const silence = new Float32Array(Math.round(0.2 * SAMPLE_RATE))
    let last: AudioState | null = null
    let time = 0
    for (const signal of [note(first), silence, note(second)]) {
      for (let start = 0; start + 2048 <= signal.length; start += 1600) {
        last = tracker.update(time, featuresOf(signal.subarray(start, start + 2048)))
        time += 33
      }
    }
    if (!last) throw new Error('No sound was played.')
    return last
  }

  it('is 0 for a fifth that is just what was asked for', () => {
    const state = play(220, 220 * 2 ** (7 / 12))

    expect(measure(skill, state)['step']).toBeCloseTo(0, -1)
  })

  it('says how far off a step is: a fourth when a fifth was asked for is 200 cents short', () => {
    const state = play(220, 220 * 2 ** (5 / 12))

    expect(measure(skill, state)['step']).toBeCloseTo(-200, -1)
  })

  it('is null until a second note has been played', () => {
    const tracker = new AudioTracker()
    const state = tracker.update(0, featuresOf(tone(220, 0.2)))

    expect(measure(skill, state)['step']).toBeNull()
  })
})

describe('the pace of the notes', () => {
  const skill = skillWith({ pace: { type: 'tempo' } })

  function paceOf(bpm: number): number | null {
    const tracker = new AudioTracker()
    let last: AudioState | null = null
    for (const { timestampMs, levelDb } of levelSeries(clickTrack(bpm, 10))) {
      last = tracker.update(timestampMs, {
        levelDb,
        peak: 0,
        pitchHz: 0,
        pitchClarity: 0
      })
    }
    return last ? (measure(skill, last)['pace'] ?? null) : null
  }

  it.each([70, 100, 140])('is %i bpm within 3 for a metronome at that pace', (bpm) => {
    expect(Math.abs((paceOf(bpm) ?? 0) - bpm)).toBeLessThanOrEqual(3)
  })

  it('is null until there are enough notes', () => {
    expect(
      measure(skill, new AudioTracker().update(0, featuresOf(tone(440, 0.1))))['pace']
    ).toBeNull()
  })
})

describe('the notes in the configuration', () => {
  it('knows the note names and the frequencies they mean', () => {
    expect(noteToMidi('A4')).toBe(69)
    expect(noteToMidi('C#3')).toBe(49)
    expect(noteToMidi('Bb2')).toBe(46)
    expect(noteToMidi('E2')).toBe(40)
    expect(noteToMidi('H4')).toBeNull()
    expect(frequencyOfMidi(noteToMidi('E2') ?? 0)).toBeCloseTo(82.41, 1)
  })

  it('refuses a target that is not a note', () => {
    const parsed = parseSkillConfig({
      id: 'x',
      category: 'instrument',
      name: { es: 'x', en: 'x' },
      metrics: { m: { type: 'pitch', target: 'Z9' } },
      phases: [
        { id: 'a', when: { m: { gt: 1 } } },
        { id: 'b', when: { m: { lt: 0 } } }
      ],
      rep: { sequence: ['a', 'b', 'a'], minDurationMs: 300 },
      rules: [{ id: 'r', severity: 'high', check: 'min(m) > 0', message: { es: 'x', en: 'x' } }]
    })

    expect(parsed.ok).toBe(false)
  })

  it('refuses a tuning that makes no sense', () => {
    const parsed = parseSkillConfig({
      id: 'x',
      category: 'instrument',
      name: { es: 'x', en: 'x' },
      audio: { a4: 900 },
      metrics: { m: { type: 'level' } },
      phases: [
        { id: 'a', when: { m: { gt: 1 } } },
        { id: 'b', when: { m: { lt: 0 } } }
      ],
      rep: { sequence: ['a', 'b', 'a'], minDurationMs: 300 },
      rules: [{ id: 'r', severity: 'high', check: 'min(m) > 0', message: { es: 'x', en: 'x' } }]
    })

    expect(parsed.ok).toBe(false)
  })
})

describe('which channels a skill uses', () => {
  it('knows a skill that listens, alone or with the body', () => {
    expect(skillChannels(skillWith({ m: { type: 'level' } }))).toEqual(['audio'])
    expect(
      skillChannels(
        skillWith(
          { m: { type: 'level' }, t: { type: 'tilt', from: 'hip', to: 'shoulder' } },
          { camera: { view: 'side', fullBody: false } }
        )
      )
    ).toEqual(['body', 'audio'])
  })

  it('does not need a camera when it only listens', () => {
    expect(skillWith({ m: { type: 'level' } }).camera).toBeUndefined()
  })
})

describe('the instrument that sounds', () => {
  const skill = skillWith({ flute: { type: 'instrument', name: 'flute' } })

  const heardFlute = (score: number): AudioState =>
    new AudioTracker().update(0, {
      ...featuresOf(tone(440, 0.1)),
      instruments: scoreInstruments([{ name: 'Flute', score }])
    })

  it('is how sure the sound is of being that instrument', () => {
    expect(measure(skill, heardFlute(0.8))['flute']).toBeCloseTo(0.8)
  })

  it('is 0 when another instrument is heard', () => {
    const guitar = new AudioTracker().update(0, {
      ...featuresOf(tone(440, 0.1)),
      instruments: scoreInstruments([{ name: 'Guitar', score: 0.9 }])
    })

    expect(measure(skill, guitar)['flute']).toBe(0)
  })

  it('is null while the sound is not being classified', () => {
    expect(measure(skill, stateOf(tone(440, 0.1)))['flute']).toBeNull()
    expect(measure(skill, null)['flute']).toBeNull()
  })

  it('belongs to the audio channel and needs no camera', () => {
    expect(skillChannels(skill)).toEqual(['audio'])
  })

  it('is read by a rule as an average, without the engine knowing any instrument', () => {
    const result = compileExpression('avg(flute) >= 0.5', ['flute'])
    if (!result.ok) throw new Error(result.error)

    expect(result.expression.evaluate({ series: { flute: [0.7, 0.8, 0.6] }, scalars: {} })).toBe(
      true
    )
    expect(result.expression.evaluate({ series: { flute: [0.1, 0.2, 0.9] }, scalars: {} })).toBe(
      false
    )
  })

  it.each(INSTRUMENTS)('accepts %s', (name) => {
    expect(() => skillWith({ heard: { type: 'instrument', name } })).not.toThrow()
  })

  it('refuses an instrument that is not in the list', () => {
    expect(() => skillWith({ heard: { type: 'instrument', name: 'kazoo' } })).toThrow()
  })
})
