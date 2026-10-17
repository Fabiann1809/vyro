import { z } from 'zod'

// What the page may know about the API key: whether there is one, never its value.
export interface AiKeyStatus {
  hasKey: boolean
  // False when the system cannot encrypt secrets, in which case no key is stored at all.
  encryptionAvailable: boolean
}

// Keys differ between providers, so only the size is checked.
export const apiKeySchema = z.string().trim().min(8).max(512)
