import type { VyroApi } from '@shared/ipc'

declare global {
  interface Window {
    api: VyroApi
  }
}
