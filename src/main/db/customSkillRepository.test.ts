import { beforeEach, describe, expect, it } from 'vitest'
import { CustomSkillRepository } from './customSkillRepository'
import { openDatabase, type Database } from './database'

let db: Database
let repository: CustomSkillRepository

beforeEach(() => {
  db = openDatabase(':memory:')
  repository = new CustomSkillRepository(db)
})

describe('CustomSkillRepository', () => {
  it('saves a skill and reads it back, with its JSON intact', () => {
    const config = { id: 'custom_yoga', name: { es: 'Yoga', en: 'Yoga' }, rules: [{ n: 1 }] }

    repository.save('custom_yoga', config, 'draft', 1_000)

    expect(repository.get('custom_yoga')).toEqual({
      id: 'custom_yoga',
      config,
      status: 'draft',
      createdAt: 1_000
    })
  })

  it('returns null for a skill that does not exist', () => {
    expect(repository.get('custom_nothing')).toBeNull()
  })

  it('does not save two skills with the same id', () => {
    repository.save('custom_yoga', {}, 'draft', 1)

    expect(() => repository.save('custom_yoga', {}, 'approved', 2)).toThrow()
  })

  it('lists them from the oldest to the newest', () => {
    repository.save('custom_b', {}, 'approved', 2_000)
    repository.save('custom_a', {}, 'approved', 1_000)

    expect(repository.list().map((record) => record.id)).toEqual(['custom_a', 'custom_b'])
  })

  it('lists only the ones with the status asked for', () => {
    repository.save('custom_draft', {}, 'draft', 1)
    repository.save('custom_ok', {}, 'approved', 2)

    expect(repository.list('approved').map((record) => record.id)).toEqual(['custom_ok'])
    expect(repository.list('draft').map((record) => record.id)).toEqual(['custom_draft'])
  })

  it('leaves out a row whose JSON is damaged instead of failing', () => {
    repository.save('custom_ok', { fine: true }, 'approved', 1)
    db.exec(
      "INSERT INTO custom_skills (id, config_json, status, created_at) VALUES ('custom_broken', '{not json', 'approved', 2)"
    )

    expect(repository.list().map((record) => record.id)).toEqual(['custom_ok'])
    expect(repository.get('custom_broken')).toBeNull()
  })

  it('approves a draft', () => {
    repository.save('custom_yoga', {}, 'draft', 1)

    expect(repository.setStatus('custom_yoga', 'approved')).toBe(true)

    expect(repository.get('custom_yoga')?.status).toBe('approved')
  })

  it('says so when the skill does not exist', () => {
    expect(repository.setStatus('custom_nothing', 'approved')).toBe(false)
    expect(repository.delete('custom_nothing')).toBe(false)
  })

  it('deletes one skill, or all of them', () => {
    repository.save('custom_a', {}, 'approved', 1)
    repository.save('custom_b', {}, 'approved', 2)

    expect(repository.delete('custom_a')).toBe(true)
    expect(repository.list().map((record) => record.id)).toEqual(['custom_b'])

    repository.deleteAll()
    expect(repository.list()).toEqual([])
  })

  describe('the draft', () => {
    it('keeps a single one: a new draft takes the place of the old one', () => {
      repository.replaceDraft('custom_a', { n: 1 }, 1)
      repository.replaceDraft('custom_b', { n: 2 }, 2)

      expect(repository.list('draft').map((record) => record.id)).toEqual(['custom_b'])
    })

    it('does not touch the approved skills', () => {
      repository.save('custom_ok', {}, 'approved', 1)

      repository.replaceDraft('custom_a', {}, 2)

      expect(repository.list('approved').map((record) => record.id)).toEqual(['custom_ok'])
    })

    it('keeps the old draft if the new one cannot be saved', () => {
      repository.save('custom_ok', {}, 'approved', 1)
      repository.replaceDraft('custom_a', {}, 2)

      // The id of an approved skill is taken.
      expect(() => repository.replaceDraft('custom_ok', {}, 3)).toThrow()

      expect(repository.list('draft').map((record) => record.id)).toEqual(['custom_a'])
    })
  })

  it('refuses a status that does not exist', () => {
    expect(() =>
      db.exec(
        "INSERT INTO custom_skills (id, config_json, status, created_at) VALUES ('x', '{}', 'secret', 1)"
      )
    ).toThrow()
  })
})
