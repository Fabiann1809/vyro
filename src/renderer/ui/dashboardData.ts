import { ruleChannel } from '@shared/skill/ruleChannels'
import { skillChannels, type SkillChannel } from '@shared/skill/skillChannels'
import type { SkillConfig, SkillRule } from '@shared/skill/skillSchema'
import type { RepQuality, SessionDetail, SessionRow } from '@shared/sessions'
import type { Quality } from './charts/quality'

// What the dashboard shows, worked out from the sessions that are kept. Pure functions: the screen
// only draws what they return. Days are the days of the person's own clock.

const DAY_MS = 86_400_000

const startOfDay = (timestamp: number): number => {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

// Whole days between two moments, by the calendar and not by 24 hour blocks.
export const daysAgo = (timestamp: number, now: number): number =>
  Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS)

const dayKey = (timestamp: number): string => String(startOfDay(timestamp))

const dayBefore = (timestamp: number): number => {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1).getTime()
}

// The days of the streak: the days in a row, ending today, with at least one session. A day with no
// session yet does not break it while the day is not over, so it may also end yesterday.
function streakDays(sessions: readonly SessionRow[], now: number): number[] {
  const days = new Set(sessions.map((session) => dayKey(session.startedAt)))
  let cursor = startOfDay(now)
  if (!days.has(String(cursor))) cursor = dayBefore(cursor)
  const streak: number[] = []
  while (days.has(String(cursor))) {
    streak.push(cursor)
    cursor = dayBefore(cursor)
  }
  return streak
}

export const streakLength = (sessions: readonly SessionRow[], now: number): number =>
  streakDays(sessions, now).length

export type ScoreRange = '7' | '30' | 'all'

export interface ScorePoint {
  sessionId: number
  startedAt: number
  score: number
}

// The scores of the sessions, from the oldest to the newest, in the days asked for. A session where
// nothing could be judged has no score and is left out.
export function scorePoints(
  sessions: readonly SessionRow[],
  range: ScoreRange,
  now: number
): ScorePoint[] {
  const days = range === 'all' ? Infinity : Number(range)
  return sessions
    .filter(
      (session): session is SessionRow & { score: number } =>
        session.score !== null && daysAgo(session.startedAt, now) < days
    )
    .sort((a, b) => a.startedAt - b.startedAt || a.id - b.id)
    .map((session) => ({
      sessionId: session.id,
      startedAt: session.startedAt,
      score: session.score
    }))
}

export type ScoreStory =
  | { kind: 'none' }
  | { kind: 'one'; score: number }
  | { kind: 'rise' | 'drop' | 'flat'; first: number; last: number; delta: number; count: number }

// What the scores say in a sentence: they went up, down or stayed.
export function scoreStory(points: readonly ScorePoint[]): ScoreStory {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return { kind: 'none' }
  if (points.length === 1) return { kind: 'one', score: first.score }
  const delta = last.score - first.score
  return {
    kind: delta > 0 ? 'rise' : delta < 0 ? 'drop' : 'flat',
    first: first.score,
    last: last.score,
    delta: Math.abs(delta),
    count: points.length
  }
}

export type HeatLevel = 0 | 1 | 2 | 3

export interface HeatDay {
  key: string
  // The start of that day.
  date: number
  level: HeatLevel
  streak: boolean
  // The best score of the day; null with no session, or when nothing could be judged.
  score: number | null
  sessions: number
}

const levelOf = (score: number | null, sessions: number): HeatLevel => {
  if (sessions === 0) return 0
  if (score === null || score < 65) return 1
  return score < 80 ? 2 : 3
}

// The last weeks, a day each, from the oldest to today.
export function heatmapDays(sessions: readonly SessionRow[], now: number, weeks = 12): HeatDay[] {
  const total = weeks * 7
  const streak = new Set(streakDays(sessions, now).map(String))
  const byDay = new Map<string, SessionRow[]>()
  for (const session of sessions) {
    const key = dayKey(session.startedAt)
    byDay.set(key, [...(byDay.get(key) ?? []), session])
  }

  const today = startOfDay(now)
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(today)
    date.setDate(date.getDate() - (total - 1 - index))
    const start = startOfDay(date.getTime())
    const key = String(start)
    const ofDay = byDay.get(key) ?? []
    const scores = ofDay.flatMap((session) => (session.score === null ? [] : [session.score]))
    const best = scores.length === 0 ? null : Math.max(...scores)
    return {
      key,
      date: start,
      level: levelOf(best, ofDay.length),
      streak: streak.has(key),
      score: best,
      sessions: ofDay.length
    }
  })
}

export const toChartQuality = (quality: RepQuality): Quality | null =>
  quality === 'good' ? 'good' : quality === 'needs-work' ? 'warn' : quality === 'bad' ? 'bad' : null

// The quality of each repetition of a session in order. A repetition that could not be judged says
// nothing, so it is not drawn.
export function repQualities(detail: SessionDetail): Quality[] {
  return [...detail.reps]
    .sort((a, b) => a.index - b.index)
    .flatMap((rep) => {
      const quality = toChartQuality(rep.quality)
      return quality ? [quality] : []
    })
}

export type FatigueStory =
  | { kind: 'too-few' }
  | { kind: 'steady' }
  | { kind: 'wears-out'; firstFailures: number; lastFailures: number; half: number }

// Whether the technique gets worse towards the end: the failures of the first half of the
// repetitions against those of the second half.
export function fatigueStory(qualities: readonly Quality[]): FatigueStory {
  if (qualities.length < 6) return { kind: 'too-few' }
  const half = Math.floor(qualities.length / 2)
  const failures = (part: readonly Quality[]): number =>
    part.filter((quality) => quality !== 'good').length
  const firstFailures = failures(qualities.slice(0, half))
  const lastFailures = failures(qualities.slice(-half))
  return lastFailures > firstFailures
    ? { kind: 'wears-out', firstFailures, lastFailures, half }
    : { kind: 'steady' }
}

export interface ErrorRow {
  skillId: string
  ruleId: string
  message: SkillRule['message']
  channel: SkillChannel
  // The repetitions that failed it in the last four weeks.
  count: number
  // And in the four weeks before.
  before: number
}

const ERROR_WINDOW_DAYS = 28
export const MAX_ERROR_ROWS = 5

// The rules that were failed most in the last four weeks, with how many times in the four weeks
// before so that the change can be told.
export function errorRows(
  details: readonly SessionDetail[],
  skills: readonly SkillConfig[],
  now: number
): ErrorRow[] {
  const counts = new Map<
    string,
    { skill: SkillConfig; ruleId: string; now: number; before: number }
  >()

  for (const detail of details) {
    const skill = skills.find((candidate) => candidate.id === detail.skillId)
    if (!skill) continue
    const age = daysAgo(detail.startedAt, now)
    if (age >= 2 * ERROR_WINDOW_DAYS) continue
    const recent = age < ERROR_WINDOW_DAYS
    for (const rep of detail.reps) {
      for (const ruleId of rep.failedRuleIds) {
        if (!skill.rules.some((rule) => rule.id === ruleId)) continue
        const key = `${skill.id}/${ruleId}`
        const entry = counts.get(key) ?? { skill, ruleId, now: 0, before: 0 }
        if (recent) entry.now++
        else entry.before++
        counts.set(key, entry)
      }
    }
  }

  return [...counts.values()]
    .filter((entry) => entry.now > 0)
    .sort((a, b) => b.now - a.now || a.ruleId.localeCompare(b.ruleId))
    .slice(0, MAX_ERROR_ROWS)
    .map((entry) => ({
      skillId: entry.skill.id,
      ruleId: entry.ruleId,
      message: entry.skill.rules.find((rule) => rule.id === entry.ruleId)!.message,
      channel: ruleChannel(entry.skill, entry.ruleId),
      count: entry.now,
      before: entry.before
    }))
}

export interface ChannelSeries {
  channel: SkillChannel
  // The share of the repetitions, from 0 to 100, that failed a rule of this channel, session by
  // session from the oldest.
  rates: number[]
}

export const CHANNEL_SESSIONS = 9

// How often each channel failed, session after session: the lower the better. Only the sessions of
// skills that use the channel count, and only the repetitions that could be judged.
export function channelSeries(
  details: readonly SessionDetail[],
  skills: readonly SkillConfig[]
): ChannelSeries[] {
  const ordered = [...details].sort((a, b) => a.startedAt - b.startedAt || a.id - b.id)
  const rates = new Map<SkillChannel, number[]>()

  for (const detail of ordered) {
    const skill = skills.find((candidate) => candidate.id === detail.skillId)
    if (!skill) continue
    const judged = detail.reps.filter((rep) => rep.quality !== 'unknown')
    if (judged.length === 0) continue
    for (const channel of skillChannels(skill)) {
      const failed = judged.filter((rep) =>
        rep.failedRuleIds.some((ruleId) => ruleChannel(skill, ruleId) === channel)
      ).length
      rates.set(channel, [
        ...(rates.get(channel) ?? []),
        Math.round((failed / judged.length) * 100)
      ])
    }
  }

  return [...rates.entries()].map(([channel, values]) => ({
    channel,
    rates: values.slice(-CHANNEL_SESSIONS)
  }))
}
