import { t, type MessageKey } from '@renderer/i18n'
import type { CoachError, CoachErrorKind } from '@shared/coach'

const ERROR_TEXT: Record<CoachErrorKind, MessageKey> = {
  'no-key': 'coach.error.no-key',
  auth: 'coach.error.auth',
  'rate-limit': 'coach.error.rate-limit',
  timeout: 'coach.error.timeout',
  network: 'coach.error.network',
  server: 'coach.error.server',
  request: 'coach.error.request',
  refused: 'coach.error.refused',
  cancelled: 'coach.error.cancelled',
  'not-configured': 'coach.error.not-configured',
  blocked: 'coach.error.blocked',
  'invalid-response': 'coach.error.invalid-response',
  truncated: 'coach.error.truncated',
  unknown: 'coach.error.unknown',
  'not-enabled': 'coach.error.not-enabled',
  busy: 'coach.error.busy',
  'invalid-input': 'coach.error.invalid-input'
}

// A different try will not help: something has to change in Settings first.
const NEEDS_SETTINGS: ReadonlySet<CoachErrorKind> = new Set([
  'no-key',
  'auth',
  'not-configured',
  'not-enabled',
  'request'
])

export function coachErrorMessage(error: CoachError): string {
  if (error.kind === 'rate-limit' && error.retryAfterSeconds !== undefined) {
    return t('coach.error.rate-limit-wait', { seconds: Math.ceil(error.retryAfterSeconds) })
  }
  return t(ERROR_TEXT[error.kind])
}

export const errorNeedsSettings = (error: CoachError): boolean => NEEDS_SETTINGS.has(error.kind)
