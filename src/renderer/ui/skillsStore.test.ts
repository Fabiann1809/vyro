import { beforeEach, describe, expect, it } from 'vitest'
import squatConfig from '@renderer/skills/squat.json'
import type { CustomSkillSource } from '@shared/customSkills'
import { loadCustomSkills, mergeSkills, useSkills } from './skillsStore'

const BUNDLED = ['bicep_curl', 'pushup', 'squat']

// A valid skill made from one that comes with the app.
const customSkill = (id: string): CustomSkillSource => ({
  id,
  config: { ...squatConfig, id, name: { es: `Mi ${id}`, en: `My ${id}` } }
})

const idsOf = (): string[] => useSkills.getState().skills.map((skill) => skill.id)

beforeEach(() => {
  useSkills.setState(mergeSkills([]))
})

describe('mergeSkills', () => {
  it('has only the skills that come with the app when there are no others', () => {
    expect(mergeSkills([]).skills.map((skill) => skill.id)).toEqual(BUNDLED)
    expect(mergeSkills([]).errors).toEqual([])
  })

  it('leaves out a stored skill that breaks the limits of generated skills', () => {
    const unsafe = customSkill('yoga')
    const noHigh = {
      ...squatConfig,
      id: 'custom_soft',
      rules: squatConfig.rules.map((rule) => ({ ...rule, severity: 'low' }))
    }

    const merged = mergeSkills([unsafe, { id: 'custom_soft', config: noHigh }])

    expect(merged.skills.map((skill) => skill.id)).toEqual(BUNDLED)
    expect(merged.errors.map((error) => error.source)).toEqual([
      'custom:custom_soft',
      'custom:yoga'
    ])
  })

  it('adds a valid skill made later', () => {
    const merged = mergeSkills([customSkill('custom_yoga')])

    expect(merged.skills.map((skill) => skill.id)).toEqual([...BUNDLED, 'custom_yoga'].sort())
    expect(merged.errors).toEqual([])
  })

  it('leaves out a skill that is not valid, and says so, keeping the rest', () => {
    const merged = mergeSkills([
      customSkill('custom_good'),
      { id: 'custom_broken', config: { id: 'custom_broken', name: 'not an object' } }
    ])

    expect(merged.skills.map((skill) => skill.id)).toContain('custom_good')
    expect(merged.skills.map((skill) => skill.id)).not.toContain('custom_broken')
    expect(merged.errors).toEqual([
      expect.objectContaining({ source: 'custom:custom_broken', errors: expect.any(Array) })
    ])
    expect(merged.skills.map((skill) => skill.id)).toEqual(expect.arrayContaining(BUNDLED))
  })

  it('leaves out a skill whose rules are not safe expressions', () => {
    const config = {
      ...(customSkill('custom_evil').config as Record<string, unknown>),
      rules: [
        {
          id: 'depth',
          severity: 'high',
          check: 'process.exit(1)',
          message: { es: 'x', en: 'x' }
        }
      ]
    }

    const merged = mergeSkills([{ id: 'custom_evil', config }])

    expect(merged.skills.map((skill) => skill.id)).not.toContain('custom_evil')
    expect(merged.errors).toHaveLength(1)
  })

  it('does not let a skill take the place of one that comes with the app', () => {
    const merged = mergeSkills([
      { id: 'squat', config: { ...squatConfig, name: { es: 'Falsa', en: 'Fake' } } }
    ])

    const squat = merged.skills.find((skill) => skill.id === 'squat')
    expect(squat?.name.en).toBe('Squat')
    expect(merged.errors).toEqual([
      expect.objectContaining({ errors: [expect.stringContaining('duplicate skill id "squat"')] })
    ])
  })

  it('does not count anything that is not an object', () => {
    const merged = mergeSkills([{ id: 'custom_null', config: null }])

    expect(merged.skills.map((skill) => skill.id)).toEqual(BUNDLED)
    expect(merged.errors).toHaveLength(1)
  })
})

describe('loadCustomSkills', () => {
  it('puts the approved skills of the database with the ones that come with the app', async () => {
    await loadCustomSkills({
      skills: { listCustom: () => Promise.resolve([customSkill('custom_yoga')]) }
    })

    expect(idsOf()).toContain('custom_yoga')
    expect(idsOf()).toEqual(expect.arrayContaining(BUNDLED))
  })

  it('goes on with the skills of the app when the database cannot be read', async () => {
    useSkills.setState(mergeSkills([customSkill('custom_yoga')]))

    await loadCustomSkills({
      skills: { listCustom: () => Promise.reject(new Error('no database')) }
    })

    expect(idsOf()).toEqual(BUNDLED)
  })

  it('forgets a skill that is no longer there when loaded again', async () => {
    await loadCustomSkills({
      skills: { listCustom: () => Promise.resolve([customSkill('custom_yoga')]) }
    })
    await loadCustomSkills({ skills: { listCustom: () => Promise.resolve([]) } })

    expect(idsOf()).toEqual(BUNDLED)
  })
})
