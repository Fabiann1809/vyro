import type { Language } from '@renderer/i18n'

// Vite turns every clip into a file of the app and gives its address.
const urls = import.meta.glob<string>('../assets/voice/*/*.wav', {
  eager: true,
  query: '?url',
  import: 'default'
})

export const clipFiles = Object.keys(urls)

// Where a recorded clip is, or null when there is none for that message.
export function clipUrl(language: Language, id: string): string | null {
  return urls[`../assets/voice/${language}/${id}.wav`] ?? null
}
