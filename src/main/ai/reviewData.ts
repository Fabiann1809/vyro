import type { CurrentPath } from '@shared/pathProgress'
import type { ReviewDigest } from '@shared/pathReview'
import type { ErrorCount, SessionRow } from '@shared/sessions'
import type { PathProgressService } from '../db/pathProgressService'
import type { SessionRepository } from '../db/sessionRepository'

const DAY_MS = 24 * 60 * 60 * 1000
const LAST_SCORES = 5
const MAX_ERRORS_PER_SKILL = 20
const MAX_SKILLS = 20

// What the review needs to know, as it is in the database.
export interface ReviewSource {
  current: CurrentPath
  sessions: readonly SessionRow[]
  // How many times each rule was failed since the path began, by skill.
  errorsBySkill: Readonly<Record<string, readonly ErrorCount[]>>
}

// Only the sessions that began after the path was made count for its review.
function sinceStart(source: ReviewSource): SessionRow[] {
  return source.sessions.filter((session) => session.startedAt > source.current.path.createdAt)
}

// The numbers that go to the coach: the path and how it is going. Made here, from the database, and
// not by the page, so that the page cannot add anything to it.
export function buildReviewDigest(source: ReviewSource, now: number): ReviewDigest {
  const { path, progress } = source.current
  const recent = sinceStart(source)
  const skillIds = [
    ...new Set([
      ...path.steps.flatMap((step) => (step.kind === 'skill' ? [step.skillId] : [])),
      ...recent.map((session) => session.skillId)
    ])
  ].slice(0, MAX_SKILLS)

  return {
    goal: path.goal,
    daysSinceStart: Math.max(0, Math.floor((now - path.createdAt) / DAY_MS)),
    steps: path.steps.map((step) => {
      const stepProgress = progress.steps.find((item) => item.stepId === step.id)
      return {
        id: step.id,
        position: step.position,
        title: step.title,
        kind: step.kind,
        skillId: step.skillId,
        criterionSessions: step.criterionSessions,
        criterionScore: step.criterionScore,
        state: stepProgress?.state ?? 'locked',
        counted: stepProgress?.counted ?? null,
        attempts: stepProgress?.attempts ?? null
      }
    }),
    skills: skillIds.map((skillId) => {
      const sessions = recent
        .filter((session) => session.skillId === skillId)
        .sort((a, b) => a.startedAt - b.startedAt)
      const scores = sessions.flatMap((session) => (session.score === null ? [] : [session.score]))
      return {
        skillId,
        sessions: sessions.length,
        averageScore:
          scores.length === 0
            ? null
            : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
        lastScores: scores.slice(-LAST_SCORES),
        errors: (source.errorsBySkill[skillId] ?? [])
          .slice(0, MAX_ERRORS_PER_SKILL)
          .map(({ ruleId, count }) => ({ ruleId, count }))
      }
    })
  }
}

// Reads from the database what a review needs. Null when there is no path being followed: a path
// that is already completed has nothing left to adjust.
export function loadReviewSource(
  progress: PathProgressService,
  sessions: SessionRepository
): ReviewSource | null {
  const current = progress.current()
  if (!current || current.path.status !== 'active') return null

  const all = sessions.list()
  const skillIds = new Set(all.map((session) => session.skillId))
  for (const step of current.path.steps) if (step.kind === 'skill') skillIds.add(step.skillId)

  return {
    current,
    sessions: all,
    errorsBySkill: Object.fromEntries(
      [...skillIds].map((skillId) => [
        skillId,
        sessions.errorCounts(skillId, current.path.createdAt)
      ])
    )
  }
}
