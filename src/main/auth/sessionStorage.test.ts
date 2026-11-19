import { describe, expect, it } from 'vitest'
import type { KeyFile, SecretStorage } from '../ai/keyStore'
import { EncryptedAuthStorage } from './sessionStorage'

const TOKEN = 'refresh-token-abc'

function setup(encryptionAvailable = true): {
  file: KeyFile
  storage: SecretStorage
  disk: () => Buffer | null
} {
  let content: Buffer | null = null
  return {
    file: {
      read: () => content,
      write: (data) => void (content = data),
      remove: () => void (content = null)
    },
    storage: {
      isEncryptionAvailable: () => encryptionAvailable,
      encryptString: (plain) => Buffer.from(`enc:${plain}`),
      decryptString: (encrypted) => encrypted.toString().slice(4)
    },
    disk: () => content
  }
}

describe('EncryptedAuthStorage', () => {
  it('keeps items and survives a restart', () => {
    const { file, storage } = setup()
    const first = new EncryptedAuthStorage(storage, file)
    first.setItem('session', TOKEN)
    expect(first.getItem('session')).toBe(TOKEN)

    const second = new EncryptedAuthStorage(storage, file)
    expect(second.getItem('session')).toBe(TOKEN)
    second.removeItem('session')
    expect(new EncryptedAuthStorage(storage, file).getItem('session')).toBeNull()
  })

  it('writes only what the system encrypted, never the token in plain text', () => {
    const { file, storage, disk } = setup()
    new EncryptedAuthStorage(storage, file).setItem('session', TOKEN)
    expect(disk()?.toString().startsWith('enc:')).toBe(true)
  })

  it('removes the file when nothing is left', () => {
    const { file, storage, disk } = setup()
    const store = new EncryptedAuthStorage(storage, file)
    store.setItem('session', TOKEN)
    store.removeItem('session')
    expect(disk()).toBeNull()
  })

  it('writes nothing when the system cannot encrypt, but works in memory', () => {
    const { file, storage, disk } = setup(false)
    const store = new EncryptedAuthStorage(storage, file)
    store.setItem('session', TOKEN)
    expect(store.getItem('session')).toBe(TOKEN)
    expect(disk()).toBeNull()
  })

  it('starts empty when the stored data cannot be read any more', () => {
    const { file, storage } = setup()
    file.write(Buffer.from('garbage'))
    expect(new EncryptedAuthStorage(storage, file).getItem('session')).toBeNull()
  })
})
