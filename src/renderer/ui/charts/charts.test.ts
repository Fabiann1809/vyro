import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BandChart } from './BandChart'
import { EmptyChart } from './EmptyChart'
import { pickLabels } from './geometry'
import { Heatmap } from './Heatmap'
import { HBars } from './HBars'
import { LineChart } from './LineChart'
import { NeedleMeter } from './NeedleMeter'
import { QualityBars } from './QualityBars'
import { Ring } from './Ring'
import { SegmentedBar } from './SegmentedBar'
import { Sparkline } from './Sparkline'

// The charts are drawn without a window here; the one thing they ask of it is whether the person
// wants less movement.
beforeEach(() => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
})

function html<Props extends object>(
  component: (props: Props) => React.JSX.Element,
  props: Props
): string {
  return renderToStaticMarkup(createElement(component, props))
}

describe('LineChart', () => {
  const props = {
    values: [55, 70, 90, 78],
    labels: ['1 oct', '8 oct', '15 oct', '17 oct'],
    summary: 'Tu puntuación sube',
    seriesName: 'Puntuación'
  }

  it('says what it shows to a screen reader, and gives the data as a table', () => {
    const markup = html(LineChart, props)

    expect(markup).toContain('aria-label="Tu puntuación sube"')
    expect(markup).toContain('<table')
    // One row of headings and one for each value.
    expect(markup.match(/<tr>/g)).toHaveLength(props.values.length + 1)
    expect(markup).toContain('<td>15 oct</td><td>90</td>')
  })

  it('names the best mark', () => {
    expect(html(LineChart, props)).toContain('Mejor marca · 90')
  })

  it('shows where the series is heading', () => {
    expect(html(LineChart, props)).toContain('stroke-dasharray="4 5"')
  })

  it('draws one dot for each value', () => {
    expect(html(LineChart, props).match(/<circle/g)).toHaveLength(props.values.length + 1)
  })
})

describe('pickLabels', () => {
  it('keeps a short list as it is', () => {
    expect(pickLabels(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('takes the first, the last and some in between from a long one', () => {
    const labels = Array.from({ length: 12 }, (_, index) => `d${index}`)

    expect(pickLabels(labels)).toEqual(['d0', 'd4', 'd7', 'd11'])
  })
})

describe('SegmentedBar', () => {
  it('leaves out the parts that are empty and describes the whole', () => {
    const markup = html(SegmentedBar, {
      summary: '14 limpios y 4 fallidos',
      segments: [
        { quality: 'good', count: 14, label: '14 limpios' },
        { quality: 'warn', count: 0, label: '0 mejorables' },
        { quality: 'bad', count: 4, label: '4 fallidos' }
      ]
    })

    expect(markup).toContain('aria-label="14 limpios y 4 fallidos"')
    expect(markup).not.toContain('0 mejorables')
    expect(markup).toContain('pattern-bad')
  })
})

describe('QualityBars', () => {
  it('draws one bar for each repetition, as tall as it was good', () => {
    const markup = html(QualityBars, {
      qualities: ['good', 'warn', 'bad'],
      labels: ['Repetición 1: bien', 'Repetición 2: mejorable', 'Repetición 3: mal'],
      summary: 'Calidad repetición a repetición'
    })

    expect(markup.match(/title="/g)).toHaveLength(3)
    expect(markup).toContain('height:100%')
    expect(markup).toContain('height:56%')
    expect(markup).toContain('height:20%')
    expect(markup).toContain('pattern-warn')
  })
})

describe('HBars', () => {
  it('sizes each bar against the longest one', () => {
    const markup = html(HBars, {
      rows: [
        { key: 'a', label: 'Baja más la cadera', value: '14 veces', count: 14, fill: 'bg-ch-body' },
        { key: 'b', label: 'Pecho arriba', value: '7 veces', count: 7, fill: 'bg-ch-body' }
      ]
    })

    expect(markup).toContain('width:100%')
    expect(markup).toContain('width:50%')
  })

  it('says how a row changed', () => {
    const markup = html(HBars, {
      rows: [
        {
          key: 'a',
          label: 'Pecho arriba',
          value: '8 veces',
          count: 8,
          fill: 'bg-ch-body',
          change: { text: '3 menos', tone: 'better' }
        }
      ]
    })

    expect(markup).toContain('3 menos')
    expect(markup).toContain('text-good-text')
  })
})

describe('Heatmap', () => {
  it('draws a square for each day and rings the days of the streak', () => {
    const markup = html(Heatmap, {
      summary: '12 sesiones en 4 semanas',
      cells: [
        { key: 'a', title: '1 oct', level: 0, streak: false },
        { key: 'b', title: '2 oct · 78', level: 3, streak: true }
      ]
    })

    expect(markup.match(/title="/g)).toHaveLength(2)
    expect(markup).toContain('bg-good ')
    expect(markup.match(/inset_0_0_0_1.5px/g)).toHaveLength(1)
  })
})

describe('Ring', () => {
  it('shows the score, and describes it', () => {
    const markup = html(Ring, { percent: 84, summary: 'Puntuación 84 de 100' })

    expect(markup).toContain('aria-label="Puntuación 84 de 100"')
    expect(markup).toContain('>84<')
  })
})

describe('NeedleMeter', () => {
  it('puts the needle in the middle when the note is right', () => {
    expect(html(NeedleMeter, { cents: 0 })).toContain('left:50%')
  })

  it('moves it to the side of the note that is off, and keeps it inside', () => {
    expect(html(NeedleMeter, { cents: 25 })).toContain('left:75%')
    expect(html(NeedleMeter, { cents: 90 })).toContain('left:100%')
  })
})

describe('BandChart and Sparkline', () => {
  it('draws the line inside the aim', () => {
    const markup = html(BandChart, {
      values: [30, 20, 10],
      range: { min: 0, max: 40 },
      band: { min: 10, max: 25 },
      summary: 'Torso'
    })

    expect(markup).toContain('aria-label="Torso"')
    expect(markup).toContain('<rect')
  })

  it('draws a shape and nothing to read', () => {
    expect(html(Sparkline, { values: [0.5, 1, 0] })).toContain('aria-hidden="true"')
  })
})

describe('EmptyChart', () => {
  it('says what is missing', () => {
    expect(html(EmptyChart, { message: 'Necesitas al menos dos sesiones' })).toContain(
      'Necesitas al menos dos sesiones'
    )
  })
})
