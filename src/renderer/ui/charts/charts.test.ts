import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BandChart } from './BandChart'
import { EmptyChart } from './EmptyChart'
import { pickLabels } from './geometry'
import { ArcGauge } from './ArcGauge'
import { ErrorBubbles } from './ErrorBubbles'
import { LineChart } from './LineChart'
import { NeedleMeter } from './NeedleMeter'
import { RepNecklace } from './RepNecklace'
import { Ring } from './Ring'
import { Sunburst } from './Sunburst'
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
    expect(html(LineChart, props).match(/<circle/g)).toHaveLength(props.values.length)
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

describe('RepNecklace', () => {
  it('strings a bead for each repetition, as big as it was good', () => {
    const markup = html(RepNecklace, {
      qualities: ['good', 'warn', 'bad'],
      labels: ['Repetición 1: bien', 'Repetición 2: mejorable', 'Repetición 3: mal'],
      summary: 'Calidad repetición a repetición'
    })

    expect(markup).toContain('aria-label="Calidad repetición a repetición"')
    expect(markup.match(/title="/g)).toHaveLength(3)
    expect(markup).toContain('width:26px')
    expect(markup).toContain('width:19px')
    expect(markup).toContain('width:13px')
  })

  it('draws no bead when there is nothing to show', () => {
    const markup = html(RepNecklace, { qualities: [], labels: [], summary: 'Nada' })

    expect(markup).not.toContain('title="')
  })
})

describe('ErrorBubbles', () => {
  const rows = [
    { key: 'a', label: 'Baja más la cadera', count: 14, value: '14 veces', tint: 'text-ch-body' },
    {
      key: 'b',
      label: 'Pecho arriba',
      count: 7,
      value: '7 veces',
      tint: 'text-ch-body',
      change: { text: '3 menos', tone: 'better' as const }
    }
  ]

  it('draws a bubble for each error, with its count and what it says', () => {
    const markup = html(ErrorBubbles, { rows })

    expect(markup.match(/<li/g)).toHaveLength(2)
    expect(markup).toContain('Baja más la cadera')
    expect(markup).toContain('>14<')
  })

  it('makes the most frequent one the biggest', () => {
    const markup = html(ErrorBubbles, { rows })
    const sizes = [...markup.matchAll(/width:(\d+)px/g)].map((match) => Number(match[1]))

    expect(sizes[0]).toBeGreaterThan(sizes[1]!)
  })

  it('says the change to a screen reader', () => {
    expect(html(ErrorBubbles, { rows })).toContain('7 veces, 3 menos')
  })
})

describe('Sunburst', () => {
  it('draws a ray for each day, in the gradient for the days of the streak', () => {
    const markup = html(Sunburst, {
      summary: '12 sesiones en 4 semanas',
      big: '3',
      unit: 'días seguidos',
      cells: [
        { key: 'a', title: '1 oct', level: 0, streak: false },
        { key: 'b', title: '2 oct · 78', level: 3, streak: true }
      ]
    })

    expect(markup.match(/title="/g)).toHaveLength(2)
    expect(markup).toContain('bg-grad')
    expect(markup).toContain('>3<')
    expect(markup).toContain('días seguidos')
  })

  it('lists only the days with a session for a screen reader', () => {
    const markup = html(Sunburst, {
      summary: 'Constancia',
      big: '0',
      unit: 'días',
      cells: [
        { key: 'a', title: '1 oct', level: 0, streak: false },
        { key: 'b', title: '2 oct · 78', level: 2, streak: false }
      ]
    })

    expect(markup.match(/<li>/g)).toHaveLength(1)
  })
})

describe('ArcGauge', () => {
  it('says what it shows, and writes the value as well as pointing at it', () => {
    const markup = html(ArcGauge, {
      value: 12,
      scale: { min: 0, max: 40 },
      zone: { min: 0, max: 20 },
      display: '12 %',
      summary: 'Fallas del cuerpo: 12 de cada 100',
      minLabel: '0',
      maxLabel: '40',
      zoneLabel: 'meta ≤ 20',
      colorClass: 'text-ch-body'
    })

    expect(markup).toContain('aria-label="Fallas del cuerpo: 12 de cada 100"')
    expect(markup).toContain('>12 %<')
    expect(markup).toContain('meta ≤ 20')
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
