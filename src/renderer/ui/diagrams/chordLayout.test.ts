import { describe, expect, it } from 'vitest'
import { CHORD_NAMES } from '@shared/diagrams'
import { CHART, chordLayout } from './chordLayout'

describe('chordLayout', () => {
  it('marks open, muted and pressed strings, lowest string on the left', () => {
    const { marks } = chordLayout('C')

    expect(marks.map((mark) => mark.type)).toEqual([
      'muted',
      'finger',
      'finger',
      'open',
      'finger',
      'open'
    ])
    const [, third] = marks
    expect(third).toMatchObject({ finger: 3 })
    expect(marks.map((mark) => mark.x)).toEqual([22, 38, 54, 70, 86, 102])
  })

  it('puts a finger between the lines of its fret', () => {
    const { marks, fretYs } = chordLayout('Em')

    for (const mark of marks) {
      if (mark.type !== 'finger') continue
      const row = fretYs.findIndex((y) => y > mark.y)
      expect(row).toBeGreaterThan(0)
      expect(mark.y).toBeGreaterThan(fretYs[row - 1] ?? 0)
    }
    // Both fingers of E minor are on the second fret.
    const [low, high] = marks.filter((mark) => mark.type === 'finger')
    expect(low?.y).toBe(high?.y)
    expect(low?.y).toBe(CHART.top + 1.5 * CHART.fretGap)
  })

  it('draws a barre only for the shapes that have one, across its strings', () => {
    expect(chordLayout('G').barre).toBeNull()

    const f = chordLayout('F').barre
    expect(f).toEqual({ x1: 22, x2: 102, y: CHART.top + 0.5 * CHART.fretGap })
    // B minor: the barre starts on the 5th string, the second column.
    expect(chordLayout('Bm').barre).toMatchObject({ x1: 38, x2: 102 })
  })

  it('keeps every mark inside the chart', () => {
    for (const name of CHORD_NAMES) {
      for (const mark of chordLayout(name).marks) {
        expect(mark.x).toBeGreaterThan(0)
        expect(mark.x).toBeLessThan(CHART.width)
        expect(mark.y).toBeGreaterThan(0)
        expect(mark.y).toBeLessThan(CHART.height)
      }
    }
  })
})
