import type { AdoptionCheck } from '@shared/localData'
import type { LocalData } from './localData'

// Decides what to do with the data on this computer when an account signs in (D21).
//  - It is already this account's: nothing.
//  - Nobody has claimed it and there is none: the account claims it.
//  - Nobody has claimed it and there is some (made before accounts existed): the person decides.
//    Keeping it makes it the account's, and it is uploaded with the next sync; not keeping it
//    deletes it.
//  - Another account claimed it: that account's data is in its cloud, so it is cleared here and
//    the new account starts clean.
export class LocalAdoption {
  constructor(
    private readonly data: LocalData,
    private readonly now: () => number = Date.now
  ) {}

  check(userId: string): AdoptionCheck {
    const owner = this.data.owner()
    if (owner === userId) return { action: 'none' }

    if (owner !== null) {
      this.data.wipe()
      this.data.claim(userId, this.now())
      return { action: 'none' }
    }
    if (this.data.isEmpty()) {
      this.data.claim(userId, this.now())
      return { action: 'none' }
    }
    return { action: 'ask', counts: this.data.counts() }
  }

  // The person's answer to "ask". It only applies while nobody has claimed the data.
  resolve(userId: string, keep: boolean): void {
    const owner = this.data.owner()
    if (owner === userId) return
    if (owner !== null) throw new Error('The data on this computer belongs to another account.')
    if (!keep) this.data.wipe()
    this.data.claim(userId, this.now())
  }
}
