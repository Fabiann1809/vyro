import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiKeyStore, type KeyFile } from '../ai/keyStore'
import { createAiHandlers } from './ai'

// The handlers do not need Electron, but the module imports it.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

const KEY = 'sk-test-1234567890'

// What the usage counter says today, for the tests to change.
let tokens = 0

function setup(encryptionAvailable = true): {
  handlers: ReturnType<typeof createAiHandlers>
  store: ApiKeyStore
} {
  let content: Buffer | null = null
  const file: KeyFile = {
    read: () => content,
    write: (data) => void (content = data),
    remove: () => void (content = null)
  }
  const store = new ApiKeyStore(
    {
      isEncryptionAvailable: () => encryptionAvailable,
      encryptString: (plain) => Buffer.from(`enc:${plain}`),
      decryptString: (encrypted) => encrypted.toString().slice(4)
    },
    file
  )
  return { handlers: createAiHandlers(store, { tokensToday: () => tokens }), store }
}

let handlers: ReturnType<typeof createAiHandlers>
let store: ApiKeyStore

beforeEach(() => {
  tokens = 0
  ;({ handlers, store } = setup())
})

describe('AI key handlers', () => {
  it('saves a key without ever giving it back', () => {
    handlers.saveKey(KEY)

    expect(handlers.keyStatus()).toEqual({ hasKey: true, encryptionAvailable: true })
    expect(JSON.stringify(handlers.keyStatus())).not.toContain(KEY)
    expect(store.get()).toBe(KEY)
  })

  it('trims the spaces around a pasted key', () => {
    handlers.saveKey(`  ${KEY}\n`)

    expect(store.get()).toBe(KEY)
  })

  it.each([
    ['something that is not text', 12345678],
    ['an empty key', ''],
    ['a key that is too short', 'abc'],
    ['a key that is far too long', 'x'.repeat(600)]
  ])('rejects %s', (_name, key) => {
    expect(() => handlers.saveKey(key)).toThrow('The API key is not valid.')
    expect(handlers.keyStatus().hasKey).toBe(false)
  })

  it('does not echo a rejected value in the error', () => {
    const secret = 'shorty'

    expect(() => handlers.saveKey(secret)).toThrow(expect.not.stringContaining(secret) as never)
  })

  it('removes the key', () => {
    handlers.saveKey(KEY)

    handlers.clearKey()

    expect(handlers.keyStatus().hasKey).toBe(false)
  })

  it('says when the system cannot protect the key, and stores nothing', () => {
    const unsupported = setup(false).handlers

    expect(unsupported.keyStatus().encryptionAvailable).toBe(false)
    expect(() => unsupported.saveKey(KEY)).toThrow()
    expect(unsupported.keyStatus().hasKey).toBe(false)
  })

  it('says how many tokens were used today, and nothing else', () => {
    tokens = 12_345

    expect(handlers.usageToday()).toEqual({ tokens: 12_345 })
  })
})
