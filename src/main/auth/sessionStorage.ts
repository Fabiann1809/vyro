import type { KeyFile, SecretStorage } from '../ai/keyStore'

// The storage Supabase asks for. It keeps the session (tokens) and the PKCE verifier.
export interface AuthStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

// Keeps what the sign-in needs encrypted on disk with the system's secret storage, the same way as
// the AI key. Without encryption nothing is written: the session lives in memory and the person
// signs in again next time, because a token in plain text on disk is worse than asking twice.
export class EncryptedAuthStorage implements AuthStorage {
  private items: Map<string, string>

  constructor(
    private readonly storage: SecretStorage,
    private readonly file: KeyFile
  ) {
    this.items = this.load()
  }

  get persistent(): boolean {
    return this.storage.isEncryptionAvailable() && !this.storage.isWeakBackend?.()
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
    this.save()
  }

  removeItem(key: string): void {
    this.items.delete(key)
    this.save()
  }

  private load(): Map<string, string> {
    const encrypted = this.file.read()
    if (!encrypted || !this.persistent) return new Map()
    try {
      const parsed: unknown = JSON.parse(this.storage.decryptString(encrypted))
      if (typeof parsed !== 'object' || parsed === null) return new Map()
      const entries = Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
      return new Map(entries)
    } catch {
      // It cannot be read any more (for example after moving to another user account).
      return new Map()
    }
  }

  private save(): void {
    if (!this.persistent) return
    if (this.items.size === 0) {
      this.file.remove()
      return
    }
    this.file.write(this.storage.encryptString(JSON.stringify(Object.fromEntries(this.items))))
  }
}
