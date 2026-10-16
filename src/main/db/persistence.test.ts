import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './database'
import { SessionRepository } from './sessionRepository'

let folder: string

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'vyro-db-'))
})

afterEach(() => {
  rmSync(folder, { recursive: true, force: true })
})

describe('database file', () => {
  it('keeps the sessions after the app is closed and opened again', () => {
    const path = join(folder, 'vyro.db')

    const first = openDatabase(path)
    const id = new SessionRepository(first).save({
      skillId: 'squat',
      startedAt: 1_000,
      durationMs: 60_000,
      score: 100,
      reps: [{ index: 1, quality: 'good', durationMs: 2500, failedRuleIds: [] }]
    })
    first.close()

    const second = openDatabase(path)
    try {
      expect(new SessionRepository(second).get(id)).toMatchObject({ skillId: 'squat', repCount: 1 })
    } finally {
      second.close()
    }
  })
})
