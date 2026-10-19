import { describe, expect, it } from 'vitest'
import { bundledSkills } from '@renderer/skills'
import { fourChannelSkill } from '@shared/skill/skillFixtures'
import type { SkillConfig } from '@shared/skill/skillSchema'
import {
  categoryOf,
  filterSkills,
  skillLine,
  skillNeeds,
  toLibrarySkill,
  type LibrarySkill
} from './librarySkills'

const byId = (id: string): SkillConfig => {
  const skill = bundledSkills.skills.find((candidate) => candidate.id === id)
  if (!skill) throw new Error(`no skill ${id}`)
  return skill
}

const all: LibrarySkill[] = bundledSkills.skills.map(toLibrarySkill)

describe('categoryOf', () => {
  it('maps the categories of the skills that come with the app', () => {
    expect(categoryOf(byId('squat'))).toBe('fitness')
    expect(categoryOf(byId('piano_note'))).toBe('music')
  })

  it('calls a skill made by the AI generated, whatever its category', () => {
    expect(categoryOf({ ...byId('squat'), id: 'custom_yoga' })).toBe('generated')
  })

  it('puts an unknown category under "other"', () => {
    expect(categoryOf({ ...byId('squat'), category: 'cooking' })).toBe('other')
  })
})

describe('toLibrarySkill', () => {
  it('lists the channels in the order the interface always uses', () => {
    expect(toLibrarySkill(fourChannelSkill).channels).toEqual(['body', 'hands', 'object', 'audio'])
  })
})

describe('filterSkills', () => {
  it('keeps everything when nothing is chosen', () => {
    expect(filterSkills(all, { channel: null, category: null })).toHaveLength(all.length)
  })

  it('keeps the skills that use a channel, among others', () => {
    const ids = filterSkills(all, { channel: 'audio', category: null }).map((e) => e.skill.id)

    expect(ids).toContain('piano_note')
    expect(ids).toContain('string_tuning')
    expect(ids).not.toContain('squat')
  })

  it('combines the channel and the category', () => {
    const ids = filterSkills(all, { channel: 'body', category: 'music' }).map((e) => e.skill.id)

    expect(ids).toEqual(['guitar_posture'])
  })

  it('can come out empty', () => {
    expect(filterSkills(all, { channel: 'object', category: 'fitness' })).toEqual([])
  })
})

describe('skillNeeds', () => {
  it('asks for the camera only when the skill looks', () => {
    expect(skillNeeds(byId('squat'))).toEqual(['library.needs.camera'])
  })

  it('asks for the microphone alone when the skill only listens', () => {
    expect(skillNeeds(byId('string_tuning'))).toEqual(['library.needs.microphone'])
  })

  it('asks for the object too', () => {
    expect(skillNeeds(fourChannelSkill)).toEqual([
      'library.needs.camera',
      'library.needs.microphone',
      'library.needs.guitar'
    ])
  })
})

describe('skillLine', () => {
  it('has a line for every skill that comes with the app', () => {
    for (const skill of bundledSkills.skills) {
      expect(skillLine(skill)).not.toBe('library.line.generated')
    }
  })

  it('gives a generic line to the others', () => {
    expect(skillLine({ ...byId('squat'), id: 'custom_yoga' })).toBe('library.line.generated')
  })
})
