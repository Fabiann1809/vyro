import { describe, expect, it } from 'vitest'
import { useSession } from './sessionStore'

describe('session store', () => {
  it('starts without a chosen skill and remembers the one picked', () => {
    expect(useSession.getState().skillId).toBeNull()

    useSession.getState().selectSkill('squat')

    expect(useSession.getState().skillId).toBe('squat')
  })
})
