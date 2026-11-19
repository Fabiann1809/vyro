import { describe, expect, it } from 'vitest'
import type { AuthResult } from '@shared/account'
import { ReturnInbox } from './returnInbox'

const FAILED: AuthResult = { ok: false, error: 'invalid-code' }

describe('ReturnInbox', () => {
  it('hands a result over once', () => {
    const inbox = new ReturnInbox()
    inbox.put(FAILED)
    expect(inbox.take()).toEqual(FAILED)
    expect(inbox.take()).toBeNull()
  })

  it('is empty at the start', () => {
    expect(new ReturnInbox().take()).toBeNull()
  })

  it('keeps only the latest result', () => {
    const inbox = new ReturnInbox()
    inbox.put(FAILED)
    inbox.put({ ok: true, status: { state: 'signed-in', email: 'ana@mail.com' } })
    expect(inbox.take()).toMatchObject({ ok: true })
  })

  it('forgets a result that waited too long', () => {
    let now = 1_000
    const inbox = new ReturnInbox(() => now)
    inbox.put(FAILED)
    now += 61_000
    expect(inbox.take()).toBeNull()
  })
})
