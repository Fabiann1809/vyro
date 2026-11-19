import { currentLanguage, type MessageKey } from '@renderer/i18n'
import type { SyncInfo } from '@shared/account'

// What to tell the person about the sync: the most important thing first. A failure is shown even if
// something is waiting, because that is why it is waiting.
export function syncLine(info: SyncInfo): { key: MessageKey; params?: { time: string } } {
  if (!info.enabled) return { key: 'account.sync.off' }
  if (info.lastError) return { key: `account.sync.error.${info.lastError}` }
  if (info.pending) return { key: 'account.sync.pending' }
  if (info.lastSyncAt === null) return { key: 'account.sync.never' }
  const time = new Date(info.lastSyncAt).toLocaleTimeString(currentLanguage(), {
    hour: '2-digit',
    minute: '2-digit'
  })
  return { key: 'account.sync.synced', params: { time } }
}
