import { useEffect, useState } from 'react'
import type { CurrentPath } from '@shared/pathProgress'
import type { SessionDetail, SessionRow } from '@shared/sessions'
import { daysAgo } from '../dashboardData'

// The repetitions are only fetched for the sessions the dashboard draws from: the last eight weeks
// (the errors compare four weeks with the four before), and never more than this many.
const DETAIL_DAYS = 56
const MAX_DETAILS = 60

export interface DashboardData {
  status: 'loading' | 'ready' | 'error'
  sessions: SessionRow[]
  // The sessions with their repetitions, newest first.
  details: SessionDetail[]
  path: CurrentPath | null
}

const LOADING: DashboardData = { status: 'loading', sessions: [], details: [], path: null }

// Loads what the dashboard needs through the bridge, once, when it opens.
export function useDashboardData(now: number): DashboardData {
  const [data, setData] = useState<DashboardData>(LOADING)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<DashboardData> {
      const [sessions, path] = await Promise.all([
        window.api.sessions.list(),
        window.api.paths.getCurrent().catch(() => null)
      ])
      const recent = sessions
        .filter((session) => daysAgo(session.startedAt, now) < DETAIL_DAYS)
        .slice(0, MAX_DETAILS)
      const found = await Promise.all(recent.map((session) => window.api.sessions.get(session.id)))
      const details = found.filter((detail): detail is SessionDetail => detail !== null)
      return { status: 'ready', sessions, details, path }
    }

    load()
      .then((loaded) => {
        if (!cancelled) setData(loaded)
      })
      .catch(() => {
        if (!cancelled) setData({ ...LOADING, status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [now])

  return data
}
