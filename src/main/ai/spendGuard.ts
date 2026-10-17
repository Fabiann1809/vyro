import type { LlmErrorKind } from '@shared/coach'
import { LlmError } from './errors'
import type { GenerateRequest, LlmClient } from './llmClient'

// The most a single answer may take, whatever a caller asks for.
export const MAX_OUTPUT_TOKENS_PER_REQUEST = 4000
// The most a single question may take. A chat is cut at 40 turns of 4000 characters, far below this.
export const MAX_INPUT_TOKENS_PER_REQUEST = 40_000

// Providers do not all say how many tokens they used, so it is estimated from the text. Three
// characters per token errs on the side of counting too much, which is the safe side for a limit.
const CHARACTERS_PER_TOKEN = 3
export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / CHARACTERS_PER_TOKEN)

// Failures that happened before anything was sent: they cost nothing.
const NOTHING_SENT: ReadonlySet<LlmErrorKind> = new Set(['no-key', 'not-configured', 'blocked'])

export interface SpendLedger {
  tokensOn: (day: string) => number
  add: (day: string, tokens: number) => void
}

// Local calendar day: the limit starts again when the person's day does.
export function dayOf(time: number): string {
  const date = new Date(time)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Wraps a client so that no request is made once the day's limit is reached, and so that no single
// request is larger than allowed. Both are decided here, before the provider is called.
export class SpendLimitedClient implements LlmClient {
  constructor(
    private readonly inner: LlmClient,
    private readonly ledger: SpendLedger,
    private readonly getDailyLimit: () => number,
    private readonly now: () => number = Date.now
  ) {}

  async generate<T>(request: GenerateRequest<T>): Promise<T> {
    const day = dayOf(this.now())
    if (this.ledger.tokensOn(day) >= this.getDailyLimit()) throw new LlmError('limit-reached')

    const input =
      estimateTokens(request.system) +
      estimateTokens(request.messages.map((message) => message.content).join(''))
    if (input > MAX_INPUT_TOKENS_PER_REQUEST) throw new LlmError('too-large')

    const capped = {
      ...request,
      maxTokens: Math.min(request.maxTokens, MAX_OUTPUT_TOKENS_PER_REQUEST)
    }
    try {
      const answer = await this.inner.generate(capped)
      this.ledger.add(day, input + estimateTokens(JSON.stringify(answer)))
      return answer
    } catch (error) {
      if (error instanceof LlmError && !NOTHING_SENT.has(error.kind)) {
        this.ledger.add(day, input + estimateTokens(error.rawText ?? ''))
      }
      throw error
    }
  }
}
