import { describe, expect, it } from 'vitest'
import { RepCounter, type CompletedRep, type RepEvent } from './repCounter'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import { validSkillInput } from '@shared/skill/skillFixtures'
import type { SkillConfig } from '@shared/skill/skillSchema'

const FRAME_MS = 1000 / 30

function skillFrom(input: Record<string, unknown>): SkillConfig {
  const parsed = parseSkillConfig(input)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
}

// Squat: up (> 160°), down (< 110°), a repetition lasts at least 800 ms.
const squat = skillFrom(validSkillInput)

// Plays knee angles into a counter at 30 fps and collects what it reports.
class Session {
  readonly events: RepEvent[] = []
  private frame = 0

  constructor(readonly counter: RepCounter) {}

  feed(angles: Array<number | null>): void {
    for (const angle of angles) {
      const event = this.counter.update(this.frame * FRAME_MS, {
        knee: angle,
        torso: 0,
        kneeDrift: 0
      })
      this.frame++
      if (event) this.events.push(event)
    }
  }

  get completed(): CompletedRep[] {
    return this.events.flatMap((event) => (event.type === 'completed' ? [event.rep] : []))
  }
}

// One smooth squat from standing, down to `bottom` degrees and back up, in `frames` frames.
function squatCycle(frames: number, bottom = 90, top = 175): number[] {
  const middle = (top + bottom) / 2
  const amplitude = (top - bottom) / 2
  return Array.from(
    { length: frames },
    (_, frame) => middle + amplitude * Math.cos((2 * Math.PI * frame) / frames)
  )
}

const standing = (frames: number): number[] => Array(frames).fill(175)

// The same skill as a posture that is held: "up" is the posture and "down" is being away from it.
const held = skillFrom({
  ...validSkillInput,
  rep: { sequence: ['down', 'up', 'down'], minDurationMs: 500, holdMs: 1000 }
})

describe('RepCounter holding a posture', () => {
  it('completes a repetition once the posture has been held, even when it was there from the start', () => {
    const session = new Session(new RepCounter(held))

    session.feed(standing(40))

    expect(session.completed).toHaveLength(1)
    expect(session.completed[0]?.steps.map((step) => step.phase)).toEqual(['up', 'up'])
    expect(session.completed[0]?.durationMs).toBeGreaterThanOrEqual(1000)
  })

  it('loses the attempt when the posture is left before the time is up', () => {
    const session = new Session(new RepCounter(held))

    session.feed([...standing(20), ...Array(10).fill(90), ...standing(20)])

    expect(session.events).toEqual([])
  })

  it('judges the posture again and again while it is kept', () => {
    const session = new Session(new RepCounter(held))

    session.feed(standing(100))

    expect(session.completed).toHaveLength(3)
    expect(session.completed.map((rep) => rep.index)).toEqual([1, 2, 3])
  })

  it('keeps every frame of the hold for the rules to look at', () => {
    const session = new Session(new RepCounter(held))

    session.feed(standing(40))

    expect(session.completed[0]?.samples.length).toBeGreaterThan(25)
  })
})

describe('RepCounter', () => {
  it('counts nothing while the body has not moved', () => {
    const session = new Session(new RepCounter(squat))

    session.feed(standing(90))

    expect(session.events).toEqual([])
    expect(session.counter.count).toBe(0)
  })

  it('counts a full repetition when the body goes down and comes back up', () => {
    const session = new Session(new RepCounter(squat))

    session.feed([...standing(10), ...squatCycle(60), ...standing(10)])

    expect(session.completed).toHaveLength(1)
    expect(session.completed[0]?.index).toBe(1)
    expect(session.counter.count).toBe(1)
  })

  it('counts several repetitions in a row, numbered from 1', () => {
    const session = new Session(new RepCounter(squat))

    session.feed([...standing(10), ...squatCycle(60), ...squatCycle(60), ...squatCycle(60)])
    session.feed(standing(10))

    expect(session.completed.map((rep) => rep.index)).toEqual([1, 2, 3])
  })

  it('ignores a half repetition that never reaches the bottom', () => {
    const session = new Session(new RepCounter(squat))

    // Goes down to 135°, which is in the dead band, and comes back up.
    session.feed([...standing(10), ...squatCycle(60, 135), ...standing(10)])

    expect(session.events).toEqual([])
    expect(session.counter.count).toBe(0)
  })

  it('does not count the movement it finds the user in as a repetition', () => {
    const session = new Session(new RepCounter(squat))

    // Starts already crouching: the first thing it sees is the "down" phase.
    session.feed([90, 90, 90, ...squatCycle(60).slice(30), ...standing(10)])

    expect(session.events).toEqual([])
  })

  it('rejects a sequence that is faster than the minimum duration', () => {
    const session = new Session(new RepCounter(squat))

    session.feed([...standing(10), ...squatCycle(12), ...standing(10)])

    expect(session.events).toHaveLength(1)
    const [event] = session.events
    expect(event?.type).toBe('rejected')
    if (event?.type === 'rejected') {
      expect(event.reason).toBe('too-fast')
      expect(event.durationMs).toBeLessThan(squat.rep.minDurationMs)
    }
    expect(session.counter.count).toBe(0)
  })

  it('numbers the next valid repetition 1 after a rejected one', () => {
    const session = new Session(new RepCounter(squat))

    session.feed([...standing(10), ...squatCycle(12), ...squatCycle(60), ...standing(10)])

    expect(session.completed.map((rep) => rep.index)).toEqual([1])
  })

  describe('what a completed repetition carries', () => {
    function oneRep(): CompletedRep {
      const session = new Session(new RepCounter(squat))
      session.feed([...standing(10), ...squatCycle(60), ...standing(10)])
      const [rep] = session.completed
      if (!rep) throw new Error('expected a completed repetition')
      return rep
    }

    it('lasts from the last moment at the top until it is back at the top', () => {
      const rep = oneRep()

      expect(rep.durationMs).toBe(rep.endMs - rep.startMs)
      // The movement itself takes about 1.4 s of a 2 s cycle.
      expect(rep.durationMs).toBeGreaterThan(1200)
      expect(rep.durationMs).toBeLessThan(1700)
    })

    it('lists when each phase of the sequence was reached', () => {
      const rep = oneRep()

      expect(rep.steps.map((step) => step.phase)).toEqual(['up', 'down', 'up'])
      expect(rep.steps[0]?.timestampMs).toBe(rep.startMs)
      expect(rep.steps[2]?.timestampMs).toBe(rep.endMs)
      const times = rep.steps.map((step) => step.timestampMs)
      expect(times).toEqual([...times].sort((a, b) => a - b))
    })

    it('keeps every frame of the movement, including the deepest point', () => {
      const rep = oneRep()
      const knees = rep.samples.map((sample) => sample.values.knee ?? Infinity)

      expect(rep.samples[0]?.timestampMs).toBe(rep.startMs)
      expect(rep.samples[rep.samples.length - 1]?.timestampMs).toBe(rep.endMs)
      expect(Math.min(...knees)).toBeCloseTo(90, 0)
      expect(rep.samples.length).toBeGreaterThan(30)
    })

    it('does not include the time spent standing still before the movement', () => {
      const rep = oneRep()

      expect(rep.samples.length).toBeLessThan(60)
    })
  })

  it('forgets the attempt in progress on reset', () => {
    const session = new Session(new RepCounter(squat))

    // Halfway down the person leaves the frame.
    session.feed([...standing(10), ...squatCycle(60).slice(0, 30)])
    session.counter.reset()
    session.feed(squatCycle(60).slice(30))
    session.feed(standing(10))

    expect(session.events).toEqual([])
  })

  it('counts a new repetition after a reset', () => {
    const session = new Session(new RepCounter(squat))
    session.feed([...standing(10), ...squatCycle(60).slice(0, 30)])
    session.counter.reset()

    session.feed([...standing(10), ...squatCycle(60), ...standing(10)])

    expect(session.completed.map((rep) => rep.index)).toEqual([1])
  })

  it('drops an attempt that goes on for too long', () => {
    const session = new Session(new RepCounter(squat, { maxSamples: 20 }))

    // Down, then stuck at the bottom for far longer than the limit, then up.
    session.feed([...standing(10), 100, ...Array(60).fill(90), ...standing(30)])

    expect(session.events).toEqual([])
  })

  it('ignores frames where the body cannot be measured', () => {
    const session = new Session(new RepCounter(squat))
    const cycle = squatCycle(60)

    session.feed([...standing(10), ...cycle.slice(0, 20), null, null, null, ...cycle.slice(20)])

    expect(session.completed).toHaveLength(1)
  })

  describe('with a sequence of more than three steps', () => {
    const threeStages = skillFrom({
      ...validSkillInput,
      phases: [
        { id: 'up', when: { knee: { gt: 160 } } },
        { id: 'mid', when: { knee: { gt: 115, lt: 145 } } },
        { id: 'down', when: { knee: { lt: 100 } } }
      ],
      rep: { sequence: ['up', 'mid', 'down', 'mid', 'up'], minDurationMs: 800 }
    })

    it('counts it when every step is visited in order', () => {
      const session = new Session(new RepCounter(threeStages))

      session.feed([...standing(10), ...squatCycle(90), ...standing(10)])

      expect(session.completed).toHaveLength(1)
      expect(session.completed[0]?.steps.map((step) => step.phase)).toEqual([
        'up',
        'mid',
        'down',
        'mid',
        'up'
      ])
    })

    it('drops the attempt when a step is skipped', () => {
      const session = new Session(new RepCounter(threeStages))

      // Straight from 175° to 90° in one frame: the "mid" step is never visited.
      session.feed([...standing(10), 90, 90, 90, 90, ...standing(10)])

      expect(session.events).toEqual([])
    })
  })
})
