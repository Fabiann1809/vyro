import { describe, expect, it } from 'vitest'
import { phaseLabel } from './phaseLabel'

describe('phaseLabel', () => {
  it('has words for where the body is', () => {
    expect(phaseLabel('down')).toBe('training.phase.down')
    expect(phaseLabel('posed')).toBe('training.phase.posed')
  })

  it.each(['quiet', 'ringing', 'hit', 'some_made_up_phase', null])(
    'says nothing for %s, which is not for the person',
    (phase) => {
      expect(phaseLabel(phase)).toBeUndefined()
    }
  )
})
