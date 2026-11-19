import type { AuthResult } from '@shared/account'

// How long a result that nobody picked up is kept. The page asks for it as soon as it starts, so
// this only has to cover the moments between the app opening and the page being ready.
const KEEP_MS = 60_000

// The result of a sign-in that came back from the browser while the page was not listening yet,
// which happens when the browser opens the app for the first time with the link. The page asks
// for it once when it starts; it is handed over a single time.
export class ReturnInbox {
  private held: { result: AuthResult; at: number } | null = null

  constructor(private readonly now: () => number = Date.now) {}

  put(result: AuthResult): void {
    this.held = { result, at: this.now() }
  }

  take(): AuthResult | null {
    const held = this.held
    this.held = null
    return held && this.now() - held.at <= KEEP_MS ? held.result : null
  }
}
