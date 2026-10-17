import type { LlmErrorKind } from '@shared/coach'

export type { LlmErrorKind }

// Fixed texts. They never carry the provider's own message, which could echo parts of the
// request, and so never carry the API key either.
const MESSAGES: Record<LlmErrorKind, string> = {
  'no-key': 'There is no API key saved.',
  auth: 'The provider rejected the API key.',
  'rate-limit': 'The provider is limiting requests right now.',
  timeout: 'The provider took too long to answer.',
  network: 'Could not reach the provider.',
  server: 'The provider had a problem on its side.',
  request: 'The provider did not accept the request.',
  refused: 'The provider declined to answer.',
  cancelled: 'The request was cancelled.',
  'not-configured': 'The AI provider is not fully set up.',
  blocked: 'Some of the data is not allowed to leave the app, so nothing was sent.',
  'invalid-response': 'The answer did not match the expected format.',
  truncated: 'The answer was cut off because it was too long.',
  unknown: 'The AI request failed.'
}

const RETRYABLE: ReadonlySet<LlmErrorKind> = new Set(['rate-limit', 'timeout', 'network', 'server'])

export interface LlmErrorDetails {
  status?: number
  // How long the provider asked to wait before trying again, when it said so.
  retryAfterSeconds?: number
  // What the model wrote, for the repair loop. Kept in memory only: never logged or sent to the page.
  rawText?: string
  // What was wrong with it, one line per problem.
  issues?: string[]
}

export class LlmError extends Error {
  readonly status: number | undefined
  readonly retryAfterSeconds: number | undefined
  readonly rawText: string | undefined
  readonly issues: string[]

  constructor(
    readonly kind: LlmErrorKind,
    details: LlmErrorDetails = {}
  ) {
    super(MESSAGES[kind])
    this.name = 'LlmError'
    this.status = details.status
    this.retryAfterSeconds = details.retryAfterSeconds
    this.rawText = details.rawText
    this.issues = details.issues ?? []
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.kind)
  }
}

interface ErrorLike {
  name?: unknown
  status?: unknown
  code?: unknown
  constructor?: { name?: unknown }
}

const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETUNREACH'
])

// Turns whatever a provider SDK or `fetch` threw into an LlmError, by its HTTP status and name
// only, so every adapter classifies in the same way. The class name is read too, because not
// every SDK sets `name` on its errors.
export function classifyError(error: unknown, extra: LlmErrorDetails = {}): LlmError {
  if (error instanceof LlmError) return error

  const details = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike
  const { status, code } = details
  const names = [details.name, details.constructor?.name].filter(
    (value): value is string => typeof value === 'string'
  )
  const named = (pattern: RegExp): boolean => names.some((name) => pattern.test(name))
  const httpStatus = typeof status === 'number' ? status : undefined

  if (named(/abort/i)) return new LlmError('cancelled')
  if (named(/timeout/i) || httpStatus === 408)
    return new LlmError('timeout', { ...extra, status: httpStatus })
  if (httpStatus === 401 || httpStatus === 403)
    return new LlmError('auth', { ...extra, status: httpStatus })
  if (httpStatus === 429) return new LlmError('rate-limit', { ...extra, status: httpStatus })
  if (httpStatus !== undefined && httpStatus >= 500)
    return new LlmError('server', { ...extra, status: httpStatus })
  if (httpStatus !== undefined && httpStatus >= 400)
    return new LlmError('request', { ...extra, status: httpStatus })
  // `fetch` reports an unreachable host as a TypeError.
  if (named(/connection/i) || error instanceof TypeError) return new LlmError('network', extra)
  if (typeof code === 'string' && NETWORK_CODES.has(code)) return new LlmError('network', extra)
  return new LlmError('unknown')
}
