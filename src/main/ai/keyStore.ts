import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { AiKeyStatus } from '@shared/ai'

// The part of Electron's safeStorage that is used, so it can be replaced in tests.
export interface SecretStorage {
  isEncryptionAvailable: () => boolean
  encryptString: (plain: string) => Buffer
  decryptString: (encrypted: Buffer) => string
  // True when the system only has a fixed, readable-by-anyone key (Linux without a keyring).
  isWeakBackend?: () => boolean
}

export interface KeyFile {
  read: () => Buffer | null
  write: (data: Buffer) => void
  remove: () => void
}

export class EncryptionUnavailableError extends Error {
  constructor() {
    super('This system cannot encrypt the API key, so it was not saved.')
    this.name = 'EncryptionUnavailableError'
  }
}

export function createKeyFile(path: string): KeyFile {
  return {
    read: () => (existsSync(path) ? readFileSync(path) : null),
    write: (data) => {
      writeFileSync(path, data, { mode: 0o600 })
      // writeFileSync only applies the mode when it creates the file.
      chmodSync(path, 0o600)
    },
    remove: () => rmSync(path, { force: true })
  }
}

// Keeps the API key encrypted on disk with the operating system's secret storage. Only the main
// process holds one of these: the page can ask whether a key exists, never what it is.
export class ApiKeyStore {
  constructor(
    private readonly storage: SecretStorage,
    private readonly file: KeyFile
  ) {}

  get encryptionAvailable(): boolean {
    return this.storage.isEncryptionAvailable() && !this.storage.isWeakBackend?.()
  }

  status(): AiKeyStatus {
    return { hasKey: this.file.read() !== null, encryptionAvailable: this.encryptionAvailable }
  }

  // A key is never stored in plain text: without encryption it is simply not stored.
  save(key: string): void {
    if (!this.encryptionAvailable) throw new EncryptionUnavailableError()
    this.file.write(this.storage.encryptString(key))
  }

  // For the code that calls the AI provider, in the main process. Null when there is no key or
  // it can no longer be decrypted (for example after moving to another user account).
  get(): string | null {
    const encrypted = this.file.read()
    if (!encrypted || !this.encryptionAvailable) return null
    try {
      return this.storage.decryptString(encrypted)
    } catch {
      return null
    }
  }

  clear(): void {
    this.file.remove()
  }
}
