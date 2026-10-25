import type { MessageKey } from '@renderer/i18n'

// The greeting by the hour of the day: morning until noon, afternoon until six, night from then on
// (and until the small hours, when it is still night).
export function hourGreeting(hour: number): MessageKey {
  if (hour >= 5 && hour < 12) return 'home.greeting.morning'
  if (hour >= 12 && hour < 18) return 'home.greeting.afternoon'
  return 'home.greeting.night'
}
