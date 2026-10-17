import { describe, expect, it } from 'vitest'
import { AiUsageRepository } from './aiUsageRepository'
import { openDatabase } from './database'

describe('AiUsageRepository', () => {
  it('starts at zero and adds up through the day', () => {
    const usage = new AiUsageRepository(openDatabase(':memory:'))
    expect(usage.tokensOn('2026-10-17')).toBe(0)

    usage.add('2026-10-17', 120)
    usage.add('2026-10-17', 30)

    expect(usage.tokensOn('2026-10-17')).toBe(150)
  })

  it('keeps each day apart', () => {
    const usage = new AiUsageRepository(openDatabase(':memory:'))

    usage.add('2026-10-16', 500)

    expect(usage.tokensOn('2026-10-17')).toBe(0)
  })

  it('never subtracts', () => {
    const usage = new AiUsageRepository(openDatabase(':memory:'))
    usage.add('2026-10-17', 100)

    usage.add('2026-10-17', -50)

    expect(usage.tokensOn('2026-10-17')).toBe(100)
  })
})
