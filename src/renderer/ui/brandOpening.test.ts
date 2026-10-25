import { beforeEach, describe, expect, it } from 'vitest'
import { markOpeningPlayed, resetOpening, shouldPlayOpening } from './brandOpening'

beforeEach(resetOpening)

describe('the opening of the brand', () => {
  it('plays when the app opens', () => {
    expect(shouldPlayOpening(false)).toBe(true)
  })

  it('does not play again once it has played', () => {
    markOpeningPlayed()

    expect(shouldPlayOpening(false)).toBe(false)
  })

  it('does not play for someone who asked for less movement', () => {
    expect(shouldPlayOpening(true)).toBe(false)
  })
})
