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
