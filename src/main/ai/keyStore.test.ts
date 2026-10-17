import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ApiKeyStore,
  createKeyFile,
  EncryptionUnavailableError,
  type KeyFile,
  type SecretStorage
} from './keyStore'

const KEY = 'sk-test-1234567890'

// A reversible stand-in for the system's encryption: enough to tell plain text from encrypted.
function fakeStorage(overrides: Partial<SecretStorage> = {}): SecretStorage {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plain) => Buffer.from(`enc:${Buffer.from(plain).toString('base64')}`),
    decryptString: (encrypted) => {
      const text = encrypted.toString()
      if (!text.startsWith('enc:')) throw new Error('cannot decrypt')
      return Buffer.from(text.slice(4), 'base64').toString()
    },
    ...overrides
  }
}

function memoryFile(): KeyFile & { content: Buffer | null } {
  const file = {
    content: null as Buffer | null,
    read: () => file.content,
    write: (data: Buffer) => void (file.content = data),
    remove: () => void (file.content = null)
  }
  return file
}

describe('ApiKeyStore', () => {
  it('starts without a key', () => {
    const store = new ApiKeyStore(fakeStorage(), memoryFile())

    expect(store.status()).toEqual({ hasKey: false, encryptionAvailable: true })
    expect(store.get()).toBeNull()
  })

  it('saves a key and gives it back to the main process', () => {
    const store = new ApiKeyStore(fakeStorage(), memoryFile())

    store.save(KEY)

    expect(store.status().hasKey).toBe(true)
    expect(store.get()).toBe(KEY)
  })

  it('never writes the key in plain text', () => {
    const file = memoryFile()

    new ApiKeyStore(fakeStorage(), file).save(KEY)

    expect(file.content?.toString()).not.toContain(KEY)
  })

  it('does not expose the key in the status', () => {
    const store = new ApiKeyStore(fakeStorage(), memoryFile())
    store.save(KEY)

    expect(JSON.stringify(store.status())).not.toContain(KEY)
  })

  it('forgets the key when cleared', () => {
    const store = new ApiKeyStore(fakeStorage(), memoryFile())
    store.save(KEY)

    store.clear()

    expect(store.status().hasKey).toBe(false)
    expect(store.get()).toBeNull()
  })

  it('refuses to store a key when the system cannot encrypt', () => {
    const file = memoryFile()
    const store = new ApiKeyStore(fakeStorage({ isEncryptionAvailable: () => false }), file)

    expect(() => store.save(KEY)).toThrow(EncryptionUnavailableError)
    expect(file.content).toBeNull()
    expect(store.status().encryptionAvailable).toBe(false)
  })

  it('refuses to store a key when the only protection is a fixed, weak key', () => {
    const store = new ApiKeyStore(fakeStorage({ isWeakBackend: () => true }), memoryFile())

    expect(() => store.save(KEY)).toThrow(EncryptionUnavailableError)
  })

  it('does not put the key in the error message', () => {
    const store = new ApiKeyStore(fakeStorage({ isEncryptionAvailable: () => false }), memoryFile())

    expect(() => store.save(KEY)).toThrow(expect.not.stringContaining(KEY) as unknown as Error)
  })

  it('gives null, not an error, for a key that can no longer be decrypted', () => {
    const file = memoryFile()
    file.write(Buffer.from('garbage'))

    expect(new ApiKeyStore(fakeStorage(), file).get()).toBeNull()
  })
})

describe('key file on disk', () => {
  let folder: string

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'vyro-key-'))
  })

  afterEach(() => {
    rmSync(folder, { recursive: true, force: true })
  })

  it('survives closing and opening the app again', () => {
    const path = join(folder, 'ai-key.bin')
    new ApiKeyStore(fakeStorage(), createKeyFile(path)).save(KEY)

    const afterRestart = new ApiKeyStore(fakeStorage(), createKeyFile(path))

    expect(afterRestart.status().hasKey).toBe(true)
    expect(afterRestart.get()).toBe(KEY)
  })

  it('leaves no plain text on disk and removes the file when cleared', () => {
    const path = join(folder, 'ai-key.bin')
    const store = new ApiKeyStore(fakeStorage(), createKeyFile(path))
    store.save(KEY)

    expect(readFileSync(path).toString()).not.toContain(KEY)

    store.clear()

    expect(createKeyFile(path).read()).toBeNull()
  })
})
