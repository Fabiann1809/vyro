import { useEffect, useState } from 'react'
import type { SessionQuery, SessionRow } from '@shared/sessions'

export interface SessionListState {
  status: 'loading' | 'ready' | 'error'
  sessions: SessionRow[]
}

interface Loaded {
  // The query this answer belongs to; null sessions means it failed.
  key: string
  sessions: SessionRow[] | null
}

// Loads the saved sessions through the bridge, again whenever the query changes.
export function useSessionList({ skillId, limit }: SessionQuery = {}): SessionListState {
  const key = `${skillId ?? ''}|${limit ?? ''}`
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let cancelled = false

    window.api.sessions
      .list({ skillId, limit })
      .then((sessions) => {
        if (!cancelled) setLoaded({ key, sessions })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, sessions: null })
      })

    return () => {
      cancelled = true
    }
  }, [key, skillId, limit])

  // An answer to an older query does not count: until the new one arrives, it is loading.
  if (loaded?.key !== key) return { status: 'loading', sessions: [] }
  return loaded.sessions === null
    ? { status: 'error', sessions: [] }
    : { status: 'ready', sessions: loaded.sessions }
}
