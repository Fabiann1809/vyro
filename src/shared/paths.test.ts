import { describe, expect, it } from 'vitest'
import { MAX_PATH_STEPS, pathStepToSaveSchema, pathToSaveSchema } from './paths'

const skill = {
  title: 'Sentadilla lenta',
  description: 'Baja en tres segundos.',
  kind: 'skill',
  skillId: 'squat',
  criterionSessions: 3,
  criterionScore: 80
}

const auxiliary = {
  title: 'Descanso',
  description: '',
  kind: 'auxiliary',
  skillId: null,
  criterionSessions: null,
  criterionScore: null
}

const path = { goal: 'Hacer bien una sentadilla', steps: [skill, auxiliary] }

describe('pathToSaveSchema', () => {
  it('accepts a path of skill and auxiliary steps', () => {
    expect(pathToSaveSchema.safeParse(path).success).toBe(true)
  })

  it('trims the goal and the titles', () => {
    const parsed = pathToSaveSchema.parse({
      goal: '  Yoga  ',
      steps: [{ ...auxiliary, title: '  Respirar  ' }]
    })

    expect(parsed.goal).toBe('Yoga')
    expect(parsed.steps[0]?.title).toBe('Respirar')
  })

  it.each([
    ['no goal', { ...path, goal: '   ' }],
    ['no steps', { ...path, steps: [] }],
    ['too many steps', { ...path, steps: Array(MAX_PATH_STEPS + 1).fill(auxiliary) }],
    ['a field that is not listed', { ...path, video: 'x' }]
  ])('rejects a path with %s', (_name, bad) => {
    expect(pathToSaveSchema.safeParse(bad).success).toBe(false)
  })
})

describe('the guide of a step', () => {
  const guide = { tips: ['Círculos de cadera.', 'Sin dolor.'], minutes: 5 }

  it('is optional, and a step without it reads back with null', () => {
    expect(pathStepToSaveSchema.parse(auxiliary).guide).toBeNull()
    expect(pathStepToSaveSchema.parse({ ...auxiliary, guide }).guide).toEqual({
      ...guide,
      diagrams: []
    })
  })

  it.each([
    ['no tips', { tips: [], minutes: 5 }],
    ['too many tips', { tips: Array(6).fill('x'), minutes: 5 }],
    ['an empty tip', { tips: [' '], minutes: 5 }],
    ['a tip that is too long', { tips: ['x'.repeat(161)], minutes: 5 }],
    ['zero minutes', { tips: ['x'], minutes: 0 }],
    ['more than two hours', { tips: ['x'], minutes: 121 }],
    ['a field that is not listed', { tips: ['x'], minutes: 5, video: 'x' }]
  ])('rejects %s', (_name, bad) => {
    expect(pathStepToSaveSchema.safeParse({ ...auxiliary, guide: bad }).success).toBe(false)
  })

  it('keeps the diagrams that are named, and refuses a name that is not in the library', () => {
    const chord = { kind: 'chord', name: 'G' }

    expect(
      pathStepToSaveSchema.parse({ ...auxiliary, guide: { ...guide, diagrams: [chord] } }).guide
        ?.diagrams
    ).toEqual([chord])
    for (const bad of [
      { kind: 'chord', name: 'H' },
      { kind: 'chord', name: 'g' },
      { kind: 'chord', frets: [0, 0, 0, 0, 0, 0] },
      { kind: 'photo', name: 'G' }
    ]) {
      expect(
        pathStepToSaveSchema.safeParse({ ...auxiliary, guide: { ...guide, diagrams: [bad] } })
          .success
      ).toBe(false)
    }
    expect(
      pathStepToSaveSchema.safeParse({
        ...auxiliary,
        guide: { ...guide, diagrams: Array(5).fill(chord) }
      }).success
    ).toBe(false)
  })

  it('lights piano keys by note name, each once, with sharps and not flats', () => {
    const keys = (notes: unknown): boolean =>
      pathStepToSaveSchema.safeParse({
        ...auxiliary,
        guide: { ...guide, diagrams: [{ kind: 'keys', notes }] }
      }).success

    expect(keys(['C', 'E', 'G'])).toBe(true)
    expect(keys(['A#'])).toBe(true)
    expect(keys([])).toBe(false)
    expect(keys(['Bb'])).toBe(false)
    expect(keys(['C', 'C'])).toBe(false)
    expect(keys(['H'])).toBe(false)
  })

  it('accepts no fixed time', () => {
    expect(
      pathStepToSaveSchema.safeParse({ ...auxiliary, guide: { tips: ['x'], minutes: null } })
        .success
    ).toBe(true)
  })
})

describe('pathStepToSaveSchema', () => {
  it.each([
    ['a skill step without its skill', { ...skill, skillId: null }],
    ['a skill step without sessions to do', { ...skill, criterionSessions: null }],
    ['a skill step without a score to reach', { ...skill, criterionScore: null }],
    ['an auxiliary step with a skill', { ...auxiliary, skillId: 'squat' }],
    ['an auxiliary step with a measure', { ...auxiliary, criterionScore: 50 }],
    ['an unknown kind', { ...skill, kind: 'manual' }],
    ['a score above 100', { ...skill, criterionScore: 101 }],
    ['zero sessions', { ...skill, criterionSessions: 0 }],
    ['a fractional number of sessions', { ...skill, criterionSessions: 2.5 }],
    ['an empty title', { ...skill, title: ' ' }],
    ['a field that is not listed', { ...auxiliary, minutes: 20 }]
  ])('rejects %s', (_name, bad) => {
    expect(pathStepToSaveSchema.safeParse(bad).success).toBe(false)
  })
})
