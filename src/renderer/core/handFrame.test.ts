import { describe, expect, it } from 'vitest'
import { toObservations, type HandsResultLike } from './handFrame'
import { HAND_LANDMARK_COUNT } from './landmarks'

const hand = (x: number): HandsResultLike['landmarks'][number] =>
  Array.from({ length: HAND_LANDMARK_COUNT }, () => ({ x, y: 0.5, z: 0 }))

describe('toObservations', () => {
  it('turns what the model says into hands, with their 21 points and a visibility', () => {
    const [first] = toObservations({
      landmarks: [hand(0.3)],
      handedness: [[{ categoryName: 'Right', score: 0.9 }]]
    })

    expect(first?.landmarks).toHaveLength(HAND_LANDMARK_COUNT)
    expect(first?.landmarks[0]).toEqual({ x: 0.3, y: 0.5, z: 0, visibility: 1 })
    expect(first?.score).toBe(0.9)
  })

  it('swaps the label, since the picture is not mirrored', () => {
    const result = toObservations({
      landmarks: [hand(0.3), hand(0.7)],
      handedness: [[{ categoryName: 'Right', score: 1 }], [{ categoryName: 'Left', score: 1 }]]
    })

    expect(result.map((observation) => observation.handedness)).toEqual(['left', 'right'])
  })

  it('gives both hands, or none', () => {
    expect(toObservations({ landmarks: [], handedness: [] })).toEqual([])
  })

  it('leaves out a hand whose label it does not know', () => {
    const result = toObservations({
      landmarks: [hand(0.3), hand(0.7)],
      handedness: [[{ categoryName: 'Other', score: 1 }], [{ categoryName: 'Left', score: 1 }]]
    })

    expect(result).toHaveLength(1)
  })
})
