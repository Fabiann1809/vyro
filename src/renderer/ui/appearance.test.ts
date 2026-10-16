import { describe, expect, it } from 'vitest'
import { rootFontSize } from './appearance'

describe('rootFontSize', () => {
  it('grows with every step of the text size', () => {
    const sizes = (['normal', 'large', 'extra-large'] as const).map((size) =>
      parseInt(rootFontSize(size), 10)
    )

    expect(sizes).toEqual([100, 125, 150])
  })
})
