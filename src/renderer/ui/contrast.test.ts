import { describe, expect, it } from 'vitest'

// The Tailwind colours the interface uses, as hex values.
const COLOR = {
  white: '#ffffff',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  slate950: '#020617',
  emerald700: '#047857',
  red700: '#b91c1c',
  focusLight: '#0369a1',
  focusDark: '#38bdf8'
} as const

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const [r, g, b] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

// WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text and for interface parts such as a focus ring.
const AA_TEXT = 4.5
const AA_NON_TEXT = 3

const TEXT_PAIRS: Array<[string, keyof typeof COLOR, keyof typeof COLOR]> = [
  ['body text, light theme', 'slate900', 'white'],
  ['secondary text, light theme', 'slate600', 'white'],
  ['status text, light theme', 'slate500', 'white'],
  ['body text, dark theme', 'slate100', 'slate950'],
  ['secondary text, dark theme', 'slate400', 'slate950'],
  ['button, light theme', 'slate900', 'slate200'],
  ['button, dark theme', 'slate100', 'slate800'],
  ['error text on a light page', 'slate700', 'white'],
  ['error text on a dark page', 'slate300', 'slate950'],
  ['primary button', 'white', 'emerald700'],
  ['danger button', 'white', 'red700']
]

describe('colour contrast (WCAG AA)', () => {
  it.each(TEXT_PAIRS)('%s is readable', (_name, text, background) => {
    expect(contrast(COLOR[text], COLOR[background])).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('shows the keyboard focus in both themes', () => {
    expect(contrast(COLOR.focusLight, COLOR.white)).toBeGreaterThanOrEqual(AA_NON_TEXT)
    expect(contrast(COLOR.focusDark, COLOR.slate950)).toBeGreaterThanOrEqual(AA_NON_TEXT)
  })

  it('knows a failing pair when it sees one', () => {
    // The colour the primary button used before it was darkened.
    expect(contrast(COLOR.white, '#059669')).toBeLessThan(AA_TEXT)
  })
})
