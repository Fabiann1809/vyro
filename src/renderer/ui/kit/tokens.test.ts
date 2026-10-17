import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHANNEL_LOOK, CHANNEL_ORDER, sortChannels } from './channels'
import { ICON_PATHS } from './icons'

// The colours are read from styles.css itself, so that this test checks what ships and not a copy.
const css = readFileSync(resolve(__dirname, '../../styles.css'), 'utf-8')

type Theme = 'dark' | 'light'

function tokens(theme: Theme): Record<string, string> {
  const selector =
    theme === 'dark' ? ":root,\n:root[data-theme='dark']" : ":root[data-theme='light']"
  const start = css.indexOf(selector)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const found: Record<string, string> = {}
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) found[match[1]!] = match[2]!.trim()
  return found
}

type Rgb = [number, number, number]

const clamp = (value: number): number => Math.min(1, Math.max(0, value))
const toLinear = (value: number): number =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4

function parseColor(value: string): Rgb {
  if (value.startsWith('#')) {
    const rgb = [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16) / 255)
    return rgb.map(toLinear) as Rgb
  }
  const [, lightness, chroma, hue] = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(value) ?? []
  const l = Number(lightness)
  const a = Number(chroma) * Math.cos((Number(hue) * Math.PI) / 180)
  const b = Number(chroma) * Math.sin((Number(hue) * Math.PI) / 180)
  // OKLab to linear sRGB (Björn Ottosson's reference matrices).
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    clamp(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    clamp(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    clamp(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3)
  ]
}

const luminance = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(parseColor(a)), luminance(parseColor(b))].sort(
    (x, y) => y - x
  ) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

// WCAG 2.1 AA: 4.5:1 for text, 3:1 for icons and other parts of the interface.
const AA_TEXT = 4.5
const AA_NON_TEXT = 3

const TEXT_ON_SURFACES: Array<[text: string, surfaces: string[]]> = [
  ['t1', ['bg', 'card', 'sunk', 'fill']],
  ['t2', ['bg', 'card']],
  ['t4', ['bg', 'card', 'sunk']],
  ['mut', ['bg', 'card', 'sunk', 'side']],
  ['mut2', ['bg', 'card']],
  ['accent', ['bg', 'card']],
  ['good-text', ['card']],
  ['warn-text', ['card']],
  ['bad-text', ['card']],
  ['ch-body', ['card']],
  ['ch-hands', ['card']],
  ['ch-object', ['card']],
  ['ch-audio', ['card']],
  ['on-brand', ['brand']]
]

describe.each<Theme>(['dark', 'light'])('colours of the %s theme', (theme) => {
  const colors = tokens(theme)

  it.each(TEXT_ON_SURFACES.flatMap(([text, surfaces]) => surfaces.map((s) => [text, s] as const)))(
    '%s is readable on %s',
    (text, surface) => {
      expect(contrast(colors[text]!, colors[surface]!)).toBeGreaterThanOrEqual(AA_TEXT)
    }
  )

  it('keeps the quiet marks visible against the page', () => {
    expect(contrast(colors['mut3']!, colors['bg']!)).toBeGreaterThanOrEqual(AA_NON_TEXT)
  })

  it.each(['good', 'warn', 'bad'])('shows %s as a fill against the card', (name) => {
    expect(contrast(colors[name]!, colors['card']!)).toBeGreaterThanOrEqual(AA_NON_TEXT)
  })
})

describe('channels', () => {
  it('has a look, an icon and a name for each of the four', () => {
    expect([...CHANNEL_ORDER].sort()).toEqual(['audio', 'body', 'hands', 'object'])
    for (const channel of CHANNEL_ORDER) {
      expect(ICON_PATHS[CHANNEL_LOOK[channel].icon]).toBeTruthy()
      expect(CHANNEL_LOOK[channel].label).toBe(`channel.${channel}`)
    }
  })

  it('always lists them in the same order', () => {
    expect(sortChannels(['audio', 'body', 'object'])).toEqual(['body', 'object', 'audio'])
  })
})
