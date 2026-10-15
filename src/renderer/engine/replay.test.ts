import { describe, expect, it } from 'vitest'
import { replayRecording } from './replay'
import { parseSkillConfig } from './skillLoader'
import { validSkillInput } from './skillFixtures'
import type { SkillConfig } from './skillSchema'
import { recordKneeAngles, squatAngles, standingAngles, FRAME_MS } from './syntheticPose'

// The squat of the fixtures: up above 160°, down below 110°, and the rule "knee reaches 100° or less".
const squat: SkillConfig = (() => {
  const parsed = parseSkillConfig(validSkillInput)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

const rep = (bottomDeg: number, frames = 60): number[] => squatAngles(frames, bottomDeg)

describe('replayRecording', () => {
  it('counts nothing for a person who stands still', () => {
    const summary = replayRecording(squat, recordKneeAngles(standingAngles(90)))

    expect(summary.repCount).toBe(0)
    expect(summary.results).toEqual([])
    expect(summary.feedback).toEqual([])
    expect(summary.framesTracked).toBe(90)
  })

  it('judges three squats: two deep enough and one that is not', () => {
    const angles = [
      ...standingAngles(15),
      ...rep(90),
      ...rep(105),
      ...rep(90),
      ...standingAngles(15)
    ]

    const summary = replayRecording(squat, recordKneeAngles(angles))

    expect(summary.repCount).toBe(3)
    expect(summary.results.map((result) => result.quality)).toEqual(['good', 'bad', 'good'])
    expect(summary.results.map((result) => result.repIndex)).toEqual([1, 2, 3])
  })

  it('tells the user about the shallow squat, once, right when it ends', () => {
    const angles = [
      ...standingAngles(15),
      ...rep(90),
      ...rep(105),
      ...rep(90),
      ...standingAngles(15)
    ]

    const summary = replayRecording(squat, recordKneeAngles(angles))

    expect(summary.feedback).toHaveLength(1)
    const [entry] = summary.feedback
    expect(entry?.message).toMatchObject({
      kind: 'correction',
      ruleId: 'depth',
      message: { es: 'Baja más la cadera', en: 'Go deeper' }
    })
    // It arrives at the end of the second squat, not before and not after the third.
    expect(entry?.atMs).toBeGreaterThan((15 + 60) * FRAME_MS)
    expect(entry?.atMs).toBeLessThan((15 + 120) * FRAME_MS)
  })

  it('does not count a squat that never reaches the bottom phase', () => {
    const angles = [...standingAngles(15), ...rep(135), ...standingAngles(15)]

    const summary = replayRecording(squat, recordKneeAngles(angles))

    expect(summary.repCount).toBe(0)
    expect(summary.feedback).toEqual([])
  })

  it('does not count a movement that is too fast to be real', () => {
    const angles = [...standingAngles(15), ...squatAngles(12), ...standingAngles(15)]

    const summary = replayRecording(squat, recordKneeAngles(angles))

    expect(summary.repCount).toBe(0)
    expect(summary.rejectedReps).toBe(1)
  })

  it('gets the same result whichever side of the body faces the camera', () => {
    const angles = [...standingAngles(15), ...rep(90), ...rep(105), ...standingAngles(15)]

    const left = replayRecording(squat, recordKneeAngles(angles, { side: 'left' }))
    const right = replayRecording(squat, recordKneeAngles(angles, { side: 'right' }))

    expect(right.results.map((result) => result.quality)).toEqual(
      left.results.map((result) => result.quality)
    )
    expect(right.repCount).toBe(2)
  })

  describe('when the body is lost for a moment', () => {
    const cycle = rep(90)

    it('keeps the repetition if the person comes back quickly', () => {
      // Nine frames, 0.3 s, without anyone in view in the middle of the descent.
      const angles = [
        ...standingAngles(15),
        ...cycle.slice(0, 25),
        ...Array<null>(9).fill(null),
        ...cycle.slice(34),
        ...standingAngles(15)
      ]

      const summary = replayRecording(squat, recordKneeAngles(angles))

      expect(summary.repCount).toBe(1)
      expect(summary.framesTracked).toBeLessThan(summary.frames)
    })

    it('drops the repetition if the person is gone for over a second', () => {
      const angles = [
        ...standingAngles(15),
        ...cycle.slice(0, 25),
        ...Array<null>(45).fill(null),
        ...cycle.slice(25),
        ...standingAngles(15)
      ]

      const summary = replayRecording(squat, recordKneeAngles(angles))

      expect(summary.repCount).toBe(0)
    })

    it('keeps the count of the repetitions already done', () => {
      const angles = [
        ...standingAngles(15),
        ...rep(90),
        ...Array<null>(60).fill(null),
        ...standingAngles(15),
        ...rep(90),
        ...standingAngles(15)
      ]

      const summary = replayRecording(squat, recordKneeAngles(angles))

      expect(summary.repCount).toBe(2)
      expect(summary.results.map((result) => result.repIndex)).toEqual([1, 2])
    })
  })

  it('reports the frames in which it could not follow the body', () => {
    const angles = [...standingAngles(10), ...Array<null>(20).fill(null), ...standingAngles(10)]

    const summary = replayRecording(squat, recordKneeAngles(angles))

    expect(summary.frames).toBe(40)
    expect(summary.framesTracked).toBe(20)
  })
})
