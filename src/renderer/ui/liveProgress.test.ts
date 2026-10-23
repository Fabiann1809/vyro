import { describe, expect, it } from 'vitest'
import { sessionNumbers, type Attempt } from '@renderer/engine/sessionSummary'
import { parseSkillConfig } from '@shared/skill/skillLoader'
import { validSkillInput } from '@shared/skill/skillFixtures'
import { liveLines, unitLabel } from './liveProgress'

const good = (durationMs = 5000): Attempt => ({ quality: 'good', durationMs })
const bad = (durationMs = 5000): Attempt => ({ quality: 'bad', durationMs })

describe('liveLines', () => {
  it('shows nothing when the skill declares no measures', () => {
    expect(liveLines(sessionNumbers([good(), bad()]), [])).toEqual([])
  })

  it('shows nothing before any attempt has been judged', () => {
    expect(liveLines(sessionNumbers([]), ['cleanRate', 'timeWell', 'bestStreak'])).toEqual([])
  })

  it('says how many of the attempts were good', () => {
    const lines = liveLines(sessionNumbers([good(), bad(), good()]), ['cleanRate'])

    expect(lines).toEqual([{ key: 'training.live.clean', params: { good: 2, judged: 3 } }])
  })

  it('says the share of the time done well and the best streak in seconds', () => {
    const numbers = sessionNumbers([good(6000), bad(2000), good(2000)])

    expect(liveLines(numbers, ['timeWell', 'bestStreak'])).toEqual([
      { key: 'training.live.timeWell', params: { percent: 80 } },
      { key: 'training.live.streak', params: { seconds: 6 } }
    ])
  })

  it('does not show a streak when no attempt was good', () => {
    expect(liveLines(sessionNumbers([bad()]), ['bestStreak'])).toEqual([])
  })

  it('does not show "against the previous session", which only makes sense at the end', () => {
    expect(liveLines(sessionNumbers([good()]), ['vsPrevious'])).toEqual([])
  })
})

describe('unitLabel', () => {
  const skillWith = (progress?: unknown): Parameters<typeof unitLabel>[0] => {
    const parsed = parseSkillConfig({ ...validSkillInput, progress })
    if (!parsed.ok) throw new Error(parsed.errors.join('; '))
    return parsed.skill
  }

  it('calls an attempt a repetition unless the skill says otherwise', () => {
    expect(unitLabel(skillWith())).toBe('training.unit.reps')
    expect(unitLabel(skillWith({ unit: 'holds' }))).toBe('training.unit.holds')
  })
})
