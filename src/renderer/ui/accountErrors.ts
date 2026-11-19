import type { MessageKey } from '@renderer/i18n'
import type { AuthFailure } from '@shared/account'

// The text for each kind of failure. The server's own words never reach the person.
export const FAILURE_TEXT: Record<AuthFailure, MessageKey> = {
  'invalid-credentials': 'account.error.invalid-credentials',
  'invalid-input': 'account.error.invalid-input',
  'weak-password': 'account.error.weak-password',
  'email-not-confirmed': 'account.error.email-not-confirmed',
  'invalid-code': 'account.error.invalid-code',
  'rate-limited': 'account.error.rate-limited',
  network: 'account.error.network',
  unconfigured: 'account.error.unconfigured',
  unknown: 'account.error.unknown'
}
