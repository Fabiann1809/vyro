import { describe, expect, it } from 'vitest'
import { loadSkills, parseSkillConfig } from './skillLoader'
import { validSkillInput } from './skillFixtures'

const withId = (id: string): Record<string, unknown> => ({ ...validSkillInput, id })

describe('parseSkillConfig', () => {
  it('returns the skill when the configuration is valid', () => {
    const result = parseSkillConfig(validSkillInput)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.skill.id).toBe('squat')
  })

  it('lists what is wrong as "path: message" lines', () => {
    const result = parseSkillConfig({
      ...validSkillInput,
      rep: { sequence: ['up', 'dwn', 'up'], minDurationMs: 800 }
    })

    expect(result).toEqual({
      ok: false,
      errors: ['rep.sequence.1: the sequence uses the unknown phase "dwn"']
    })
  })

  it('reports every problem at once, not just the first', () => {
    const result = parseSkillConfig({ ...validSkillInput, id: 'Bad Id', rules: [] })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('explains a configuration that is not an object', () => {
    const result = parseSkillConfig('squat')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toContain('expected object')
  })
})

describe('rule expressions', () => {
  const rule = (check: string): Record<string, unknown> => ({
    id: 'depth',
    severity: 'high',
    check,
    message: { es: 'Baja más', en: 'Go deeper' }
  })

  it('rejects a skill whose rule uses a metric that does not exist', () => {
    const result = parseSkillConfig({ ...validSkillInput, rules: [rule('min(kne) <= 100')] })

    expect(result).toEqual({
      ok: false,
      errors: ['rules.0.check: unknown name "kne" (did you mean "knee"?) (at position 5)']
    })
  })

  it('rejects code that is not part of the expression language', () => {
    const result = parseSkillConfig({
      ...validSkillInput,
      rules: [rule('process.exit()')]
    })

    expect(result.ok).toBe(false)
  })

  it('points at the rule that is wrong when there are several', () => {
    const result = parseSkillConfig({
      ...validSkillInput,
      rules: [rule('min(knee) <= 100'), { ...rule('max(knee'), id: 'other' }]
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/^rules.1.check: /)
  })

  it('accepts the rules of a valid skill', () => {
    expect(parseSkillConfig(validSkillInput).ok).toBe(true)
  })

  it('does not load a skill with a broken rule', () => {
    const result = loadSkills({
      'squat.json': validSkillInput,
      'broken.json': { ...validSkillInput, id: 'broken', rules: [rule('knee <= 100')] }
    })

    expect(result.skills.map((skill) => skill.id)).toEqual(['squat'])
    expect(result.errors[0]?.source).toBe('broken.json')
  })
})

describe('loadSkills', () => {
  it('loads every valid configuration', () => {
    const result = loadSkills({ 'squat.json': withId('squat'), 'pushup.json': withId('pushup') })

    expect(result.errors).toEqual([])
    expect(result.skills.map((skill) => skill.id)).toEqual(['pushup', 'squat'])
  })

  it('returns skills ordered by id whatever the order of the sources', () => {
    const forward = loadSkills({ 'a.json': withId('alpha'), 'b.json': withId('beta') })
    const backward = loadSkills({ 'b.json': withId('beta'), 'a.json': withId('alpha') })

    expect(forward.skills.map((skill) => skill.id)).toEqual(['alpha', 'beta'])
    expect(backward.skills.map((skill) => skill.id)).toEqual(['alpha', 'beta'])
  })

  it('skips an invalid configuration and names the file that failed', () => {
    const result = loadSkills({
      'squat.json': withId('squat'),
      'broken.json': { ...validSkillInput, rules: [] }
    })

    expect(result.skills.map((skill) => skill.id)).toEqual(['squat'])
    expect(result.errors).toEqual([
      { source: 'broken.json', errors: ['rules: needs at least one rule'] }
    ])
  })

  it('reports a skill id that two files define', () => {
    const result = loadSkills({ 'a.json': withId('squat'), 'b.json': withId('squat') })

    expect(result.skills).toHaveLength(1)
    expect(result.errors).toEqual([
      {
        source: 'b.json',
        errors: ['id: duplicate skill id "squat" (already defined in a.json)']
      }
    ])
  })

  it('returns nothing for no sources', () => {
    expect(loadSkills({})).toEqual({ skills: [], errors: [] })
  })

  it('does not stop at a null or non-object source', () => {
    const result = loadSkills({ 'null.json': null, 'squat.json': withId('squat') })

    expect(result.skills).toHaveLength(1)
    expect(result.errors.map((error) => error.source)).toEqual(['null.json'])
  })
})
