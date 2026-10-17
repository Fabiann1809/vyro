import { describe, expect, it } from 'vitest'
import type { ObjectBox } from './objectFrame'
import { evaluateObjectFraming } from './objectFraming'

const box = (x: number, y: number, width: number, height: number): ObjectBox => ({
  x,
  y,
  width,
  height,
  score: 0.9
})

describe('evaluateObjectFraming', () => {
  it('asks to show the object when it is not seen', () => {
    expect(evaluateObjectFraming(null)).toEqual({
      object: 'pending',
      distance: 'pending',
      instruction: 'showObject'
    })
  })

  it('accepts an object that is whole and of a good size', () => {
    expect(evaluateObjectFraming(box(0.2, 0.3, 0.5, 0.3))).toEqual({
      object: 'ok',
      distance: 'ok',
      instruction: null
    })
  })

  it('asks to show the whole object when the frame cuts it off', () => {
    const report = evaluateObjectFraming(box(0.7, 0.3, 0.4, 0.3))

    expect(report).toMatchObject({ object: 'fix', instruction: 'showWholeObject' })
  })

  it('asks to bring a small object closer', () => {
    expect(evaluateObjectFraming(box(0.4, 0.4, 0.1, 0.1))).toMatchObject({
      distance: 'fix',
      instruction: 'objectCloser'
    })
  })

  it('asks to move a very big object back', () => {
    expect(evaluateObjectFraming(box(0.015, 0.1, 0.97, 0.5))).toMatchObject({
      distance: 'fix',
      instruction: 'objectBack'
    })
  })
})
