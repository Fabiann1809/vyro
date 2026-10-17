import { useEffect, useState } from 'react'
import { t } from '@renderer/i18n'
import type { LearningPath } from '@shared/paths'
import { ActivePath } from '../ActivePath'
import { PathPlanner } from '../PathPlanner'

export function PathScreen(): React.JSX.Element {
  // undefined while it is being loaded; null when there is no path being followed.
  const [path, setPath] = useState<LearningPath | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [creating, setCreating] = useState(false)
  // Bumped to read the path again after it changes.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    window.api.paths
      .getActive()
      .then((active) => {
        if (!cancelled) setPath(active)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [version])

  if (failed) return <p role="alert">{t('path.loadFailed')}</p>
  if (path === undefined) return <p role="status">{t('path.loading')}</p>

  if (creating || path === null) {
    return (
      <PathPlanner
        onSaved={() => {
          setCreating(false)
          setVersion((current) => current + 1)
        }}
        onCancel={path === null ? undefined : () => setCreating(false)}
      />
    )
  }

  return (
    <ActivePath
      path={path}
      onChanged={() => setVersion((current) => current + 1)}
      onNewPath={() => setCreating(true)}
    />
  )
}
