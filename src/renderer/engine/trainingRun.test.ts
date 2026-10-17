import { describe, expect, it } from 'vitest'
import { landmarksOf, type LandmarkRecording } from '@renderer/core/recording'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import type { SkillConfig } from '@shared/skill/skillSchema'
import { recordKneeAngles, squatAngles, standingAngles, FRAME_SIZE } from './syntheticPose'
import { TrainingRun, type TrainingSnapshot } from './trainingRun'
import squatConfig from '@renderer/skills/squat.json'

const squat: SkillConfig = (() => {
  const parsed = parseSkillConfig(squatConfig)
  if (!parsed.ok) throw new Error(parsed.errors.join('; '))
  return parsed.skill
})()

const play = (run: TrainingRun, recording: LandmarkRecording): TrainingSnapshot[] =>
  recording.frames.map((frame) =>
    run.processFrame({ timestampMs: frame.t, landmarks: landmarksOf(frame) })
  )

const set = (reps: number[][]): LandmarkRecording =>
  recordKneeAngles([...standingAngles(15), ...reps.flat(), ...standingAngles(15)])

describe('TrainingRun', () => {
  it('counts repetitions and reports the last quality and the phase', () => {
    const run = new TrainingRun(squat, FRAME_SIZE)
    const snapshots = play(run, set([squatAngles(90, 90), squatAngles(90, 90)]))
    const last = snapshots[snapshots.length - 1]

    expect(last).toMatchObject({ repCount: 2, lastQuality: 'good', phase: 'up' })
    expect(run.results).toHaveLength(2)
  })

  it('names the phase while the body goes down', () => {
    const run = new TrainingRun(squat, FRAME_SIZE)
    const phases = new Set(play(run, set([squatAngles(90, 90)])).map((snapshot) => snapshot.phase))

    expect(phases).toContain('down')
  })

  it('does not count anything while paused', () => {
    const run = new TrainingRun(squat, FRAME_SIZE)
    run.pause()
    const snapshots = play(run, set([squatAngles(90, 90)]))

    expect(run.paused).toBe(true)
    expect(snapshots[snapshots.length - 1]?.repCount).toBe(0)
  })

  it('counts again after resuming', () => {
    const run = new TrainingRun(squat, FRAME_SIZE)
    run.pause()
    run.resume()
    const snapshots = play(run, set([squatAngles(90, 90)]))

    expect(snapshots[snapshots.length - 1]?.repCount).toBe(1)
  })

  it('says the body is lost only after a while without seeing it', () => {
    const run = new TrainingRun(squat, FRAME_SIZE)
    const recording = recordKneeAngles([...standingAngles(15), ...Array(60).fill(null)])
    const snapshots = play(run, recording)

    expect(snapshots[20]?.tracking).toBe('tracking')
    expect(snapshots[snapshots.length - 1]?.tracking).toBe('lost')
  })

  it('tracks again as soon as the body is back', () => {
    const run = new TrainingRun(squat, FRAME_SIZE)
    const recording = recordKneeAngles([
      ...standingAngles(5),
      ...Array(60).fill(null),
      ...standingAngles(5)
    ])
    const snapshots = play(run, recording)

    expect(snapshots[snapshots.length - 1]?.tracking).toBe('tracking')
  })

  it('reports a correction message for a flawed repetition', () => {
    const run = new TrainingRun(squat, FRAME_SIZE)
    const messages = play(run, set([squatAngles(90, 106)]))
      .map((snapshot) => snapshot.feedback)
      .filter((feedback) => feedback !== null)

    expect(messages[0]).toMatchObject({ kind: 'correction', ruleId: 'depth' })
  })
})
