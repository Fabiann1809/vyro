import { describe, expect, it } from 'vitest'
import { useSession } from './sessionStore'

describe('session store', () => {
  it('starts without a chosen skill and remembers the one picked', () => {
    expect(useSession.getState().skillId).toBeNull()

    useSession.getState().selectSkill('squat')

    expect(useSession.getState().skillId).toBe('squat')
  })

  it('keeps the session that just ended for the summary', () => {
    expect(useSession.getState().finished).toBeNull()

    useSession.getState().finishSession({ skillId: 'squat', durationMs: 60_000, results: [] })

    expect(useSession.getState().finished).toEqual({
      skillId: 'squat',
      durationMs: 60_000,
      results: []
    })
  })

  it('starts saving a finished session and records how it went', () => {
    useSession.getState().finishSession({ skillId: 'squat', durationMs: 1, results: [] })
    expect(useSession.getState().saveStatus).toBe('saving')

    useSession.getState().setSaveStatus('saved')
    expect(useSession.getState().saveStatus).toBe('saved')
  })
})
