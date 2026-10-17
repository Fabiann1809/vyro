import { describe, expect, it } from 'vitest'
import { FRAME_SIZE, pressFrames, restFrames } from '@renderer/engine/syntheticHand'
import type { HandFrame } from '@renderer/engine/syntheticHand'
import { FRAME_MS } from '@renderer/engine/syntheticPose'
import { SkillSession } from '@renderer/engine/skillSession'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import pianoConfig from './piano-hand.json'

const piano: SkillConfig = (() => {
  const parsed = parseSkillConfig(pianoConfig)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

// Targets of the spec: how often reps are counted and how often their errors are named.
const MIN_COUNT_ACCURACY = 0.9
const MIN_ERROR_ACCURACY = 0.8

type Bone = { proximalDeg: number; pipFlexDeg: number; dipFlexDeg: number }

// A curved finger resting on the key, and lifted from it.
const REST: Bone = { proximalDeg: 15, pipFlexDeg: 36, dipFlexDeg: 20 }
const LIFTED: Bone = { proximalDeg: -20, pipFlexDeg: 20, dipFlexDeg: 10 }

interface Press {
  rest: Bone
  lifted: Bone
  wristDeg: number
  frames: number
}

const good = (changes: Partial<Press> = {}): Press => ({
  rest: REST,
  lifted: LIFTED,
  wristDeg: 0,
  frames: 30,
  ...changes
})

// The finger rests, presses and lifts the given number of times, and rests again.
function play(presses: Press[]): HandFrame[] {
  const frames: HandFrame[] = []
  const next = (): number => (frames.at(-1)?.timestampMs ?? -FRAME_MS) + FRAME_MS
  const first = presses[0] ?? good()
  frames.push(...restFrames(first.rest, first.wristDeg, 15, next()))
  for (const press of presses) {
    frames.push(...pressFrames(press.rest, press.lifted, press.wristDeg, press.frames, next()))
    frames.push(...restFrames(press.rest, press.wristDeg, 10, next()))
  }
  return frames
}

function run(presses: Press[]): { reps: number; failed: string[][] } {
  const session = new SkillSession(piano, FRAME_SIZE)
  for (const frame of play(presses)) {
    session.processFrame({ timestampMs: frame.timestampMs, landmarks: null, hand: frame.hand })
  }
  return {
    reps: session.repCount,
    failed: session.repResults.map((result) => result.failed.map((outcome) => outcome.ruleId))
  }
}

const FLAT: Press = good({
  rest: { proximalDeg: 40, pipFlexDeg: 3, dipFlexDeg: 2 },
  lifted: { proximalDeg: -20, pipFlexDeg: 0, dipFlexDeg: 0 }
})
const CLENCHED: Press = good({
  rest: { proximalDeg: 0, pipFlexDeg: 85, dipFlexDeg: 30 },
  lifted: { proximalDeg: -50, pipFlexDeg: 78, dipFlexDeg: 20 }
})

describe('piano hand skill', () => {
  it('only needs the hands, not the body', () => {
    expect(piano.metrics['arch']).toMatchObject({ points: ['indexMcp', 'indexPip', 'indexDip'] })
    expect(run([good()]).reps).toBe(1)
  })

  it('counts every press of a well done set, with no corrections', () => {
    expect(run([good(), good(), good(), good()])).toEqual({
      reps: 4,
      failed: [[], [], [], []]
    })
  })

  it('catches a finger that is flat instead of curved', () => {
    expect(run([good(), FLAT, good()]).failed).toEqual([[], ['flat_finger'], []])
  })

  it('catches a wrist that drops or rises from the level of the knuckles', () => {
    expect(run([good({ wristDeg: 30 }), good({ wristDeg: -30 })]).failed).toEqual([
      ['wrist_level'],
      ['wrist_level']
    ])
  })

  it('accepts a slightly tilted wrist', () => {
    expect(run([good({ wristDeg: 12 }), good({ wristDeg: -12 })]).failed).toEqual([[], []])
  })

  it('catches a finger that closes too much', () => {
    expect(run([CLENCHED]).failed).toEqual([['clenched_finger']])
  })

  it('does nothing when no hand is in view', () => {
    const session = new SkillSession(piano, FRAME_SIZE)
    const outputs = play([good()]).map((frame) =>
      session.processFrame({ timestampMs: frame.timestampMs, landmarks: null, hand: null })
    )

    expect(outputs.every((output) => !output.tracked)).toBe(true)
    expect(session.repCount).toBe(0)
  })
})

// Repeatable pseudo-random numbers, so a failing run can always be reproduced.
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('accuracy of the piano hand', () => {
  const random = seeded(104729)
  const between = (low: number, high: number): number => low + (high - low) * random()
  const around = (bone: Bone, spread: number): Bone => ({
    proximalDeg: bone.proximalDeg + between(-spread, spread),
    pipFlexDeg: bone.pipFlexDeg + between(-spread, spread),
    dipFlexDeg: bone.dipFlexDeg + between(-spread, spread)
  })

  const goodOnes = Array.from({ length: 10 }, () => ({
    press: good({
      rest: around(REST, 5),
      lifted: around(LIFTED, 4),
      wristDeg: between(-12, 12),
      frames: Math.round(between(20, 40))
    }),
    expected: [] as string[]
  }))
  const mistakes: Array<() => { press: Press; expected: string[] }> = [
    () => ({
      press: { ...FLAT, rest: around(FLAT.rest, 1), wristDeg: between(-8, 8) },
      expected: ['flat_finger']
    }),
    () => ({
      press: good({ wristDeg: (random() < 0.5 ? -1 : 1) * between(30, 38) }),
      expected: ['wrist_level']
    }),
    () => ({
      press: { ...CLENCHED, rest: around(CLENCHED.rest, 1) },
      expected: ['clenched_finger']
    })
  ]
  const badOnes = Array.from(
    { length: 10 },
    (_, index) => mistakes[index % mistakes.length]?.() ?? goodOnes[0]
  )
  const all = [...goodOnes, ...badOnes].flatMap((item) => (item ? [item] : []))

  // Each press is played on its own, as a set of one.
  const results = all.map(({ press, expected }) => {
    const { reps, failed } = run([press])
    const named = expected.every((id) => failed[0]?.includes(id))
    const noFalseAlarm = expected.length > 0 || failed[0]?.length === 0
    return { counted: reps === 1, right: reps === 1 && named && noFalseAlarm }
  })

  it('counts at least 90% of the presses', () => {
    expect(
      results.filter((result) => result.counted).length / results.length
    ).toBeGreaterThanOrEqual(MIN_COUNT_ACCURACY)
  })

  it('names the mistake of at least 80% of the presses', () => {
    expect(results.filter((result) => result.right).length / results.length).toBeGreaterThanOrEqual(
      MIN_ERROR_ACCURACY
    )
  })

  it('does not raise a false alarm on a well done press', () => {
    const wellDone = results.slice(0, goodOnes.length)

    expect(wellDone.every((result) => result.right)).toBe(true)
  })
})
