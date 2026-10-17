import { beforeEach, describe, expect, it } from 'vitest'
import { reviewDigestSchema } from '@shared/pathReview'
import { openDatabase } from '../db/database'
import { PathProgressService } from '../db/pathProgressService'
import { PathRepository } from '../db/pathRepository'
import { SessionRepository } from '../db/sessionRepository'
import { buildReviewDigest, loadReviewSource } from './reviewData'

const DAY = 24 * 60 * 60 * 1000
const CREATED = 1_000_000

let paths: PathRepository
let sessions: SessionRepository
let progress: PathProgressService

const train = (
  skillId: string,
  startedAt: number,
  score: number | null,
  failed: string[] = []
): void => {
  sessions.save({
    skillId,
    startedAt,
    durationMs: 60_000,
    score,
    reps: [
      {
        index: 1,
        quality: failed.length > 0 ? 'bad' : 'good',
        durationMs: 2000,
        failedRuleIds: failed
      }
    ]
  })
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  paths = new PathRepository(db)
  sessions = new SessionRepository(db)
  progress = new PathProgressService(paths, sessions)
  paths.create(
    {
      goal: 'Mejorar mi sentadilla',
      steps: [
        {
          title: 'Sentadilla lenta',
          description: 'texto largo que no hace falta enviar',
          kind: 'skill',
          skillId: 'squat',
          criterionSessions: 3,
          criterionScore: 80
        },
        {
          title: 'Descansar',
          description: '',
          kind: 'auxiliary',
          skillId: null,
          criterionSessions: null,
          criterionScore: null
        }
      ]
    },
    CREATED
  )
})

describe('the review data', () => {
  it('is nothing when there is no path', () => {
    const empty = new PathProgressService(
      new PathRepository(openDatabase(':memory:')),
      new SessionRepository(openDatabase(':memory:'))
    )

    expect(loadReviewSource(empty, new SessionRepository(openDatabase(':memory:')))).toBeNull()
  })

  it('is nothing when the path is already completed', () => {
    paths.setStepDone(paths.getCurrent()?.steps[0]?.id ?? 0, 1)
    paths.setStepDone(paths.getCurrent()?.steps[1]?.id ?? 0, 2)

    expect(loadReviewSource(progress, sessions)).toBeNull()
  })

  it('counts the sessions and the scores since the path began, and the errors', () => {
    train('squat', CREATED - 5_000, 99, ['depth'])
    train('squat', CREATED + 1_000, 60, ['depth', 'torso_lean'])
    train('squat', CREATED + 2_000, 70, ['depth'])
    train('squat', CREATED + 3_000, 85)

    const source = loadReviewSource(progress, sessions)
    const digest = buildReviewDigest(source!, CREATED + 3 * DAY + 5)

    expect(digest.daysSinceStart).toBe(3)
    expect(digest.skills).toEqual([
      {
        skillId: 'squat',
        sessions: 3,
        averageScore: 72,
        lastScores: [60, 70, 85],
        errors: [
          { ruleId: 'depth', count: 2 },
          { ruleId: 'torso_lean', count: 1 }
        ]
      }
    ])
  })

  it('keeps only the last five scores, oldest first', () => {
    for (let index = 1; index <= 7; index++) train('squat', CREATED + index * 1_000, 50 + index)

    const digest = buildReviewDigest(loadReviewSource(progress, sessions)!, CREATED)

    expect(digest.skills[0]?.lastScores).toEqual([53, 54, 55, 56, 57])
  })

  it('has no average when nothing could be judged', () => {
    train('squat', CREATED + 1_000, null)

    const digest = buildReviewDigest(loadReviewSource(progress, sessions)!, CREATED)

    expect(digest.skills[0]).toMatchObject({ sessions: 1, averageScore: null, lastScores: [] })
  })

  it('describes each step with its state and how far it is', () => {
    train('squat', CREATED + 1_000, 85)

    const digest = buildReviewDigest(loadReviewSource(progress, sessions)!, CREATED)

    expect(digest.steps).toEqual([
      expect.objectContaining({
        position: 1,
        title: 'Sentadilla lenta',
        kind: 'skill',
        skillId: 'squat',
        criterionSessions: 3,
        state: 'current',
        counted: 1,
        attempts: 1
      }),
      expect.objectContaining({ position: 2, kind: 'auxiliary', state: 'locked', counted: null })
    ])
  })

  it('lists a skill that has no step in the path but was practised', () => {
    train('pushup', CREATED + 1_000, 90)

    const digest = buildReviewDigest(loadReviewSource(progress, sessions)!, CREATED)

    expect(digest.skills.map((skill) => skill.skillId).sort()).toEqual(['pushup', 'squat'])
  })

  it('never carries the descriptions of the steps, and always fits the strict schema', () => {
    train('squat', CREATED + 1_000, 85)

    const digest = buildReviewDigest(loadReviewSource(progress, sessions)!, CREATED)

    expect(JSON.stringify(digest)).not.toContain('texto largo')
    expect(reviewDigestSchema.safeParse(digest).success).toBe(true)
  })

  it('does not count a day before it has passed', () => {
    const digest = buildReviewDigest(loadReviewSource(progress, sessions)!, CREATED - 10)

    expect(digest.daysSinceStart).toBe(0)
  })
})
