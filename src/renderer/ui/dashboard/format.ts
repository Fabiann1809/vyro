import { currentLanguage } from '@renderer/i18n'

export const formatShortDay = (timestamp: number): string =>
  new Intl.DateTimeFormat(currentLanguage(), { day: 'numeric', month: 'short' }).format(timestamp)

export const formatDayAndTime = (timestamp: number): string =>
  new Intl.DateTimeFormat(currentLanguage(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)
