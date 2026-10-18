import { useEffect, useState } from 'react'
import { currentLanguage, t } from '@renderer/i18n'
import type { PathSummary } from '@shared/paths'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { findSkill } from '../skillsStore'

const formatDay = (timestamp: number): string =>
  new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium' }).format(timestamp)

// A path whose skill was deleted cannot be followed any more.
const canResume = (path: PathSummary): boolean =>
  path.skillIds.every((skillId) => findSkill(skillId) !== undefined)

// Every path that was saved, so that none is lost from view when a new one is made. Only one is
// followed at a time: resuming an archived one archives the one that was on show.
export function SavedPaths({
  version,
  onChanged
}: {
  version: number
  onChanged: () => void
}): React.JSX.Element | null {
  const [paths, setPaths] = useState<PathSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  // The path whose deletion is waiting for the second click.
  const [confirming, setConfirming] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.paths
      .list()
      .then((found) => {
        if (!cancelled) setPaths(found)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [version])

  const run = (action: Promise<boolean>): void => {
    setConfirming(null)
    action
      .then((done) => {
        setFailed(!done)
        onChanged()
      })
      .catch(() => setFailed(true))
  }

  // With one path that is being followed there is nothing to choose from.
  const nothingToChoose =
    paths === null || paths.length === 0 || (paths.length === 1 && paths[0]?.status !== 'archived')
  if (nothingToChoose) return failed ? <FailedNote /> : null

  return (
    <Card className="flex flex-col gap-3 p-5.5">
      <h2 className="text-[0.8125rem] text-mut">{t('saved.title')}</h2>
      {failed && <FailedNote />}
      <ul className="flex flex-col gap-3">
        {paths.map((path) => {
          const followed = path.status !== 'archived'
          return (
            <li
              key={path.id}
              className="flex flex-col gap-2 border-t border-line/10 pt-3 first:border-0 first:pt-0"
            >
              <p className="font-semibold text-pretty">{path.goal}</p>
              <p className="text-[0.8125rem] text-mut">
                {t('path.progress', { done: path.doneCount, total: path.stepCount })} ·{' '}
                {formatDay(path.createdAt)}
              </p>
              {followed && <p className="text-[0.8125rem] text-t4">{t('saved.following')}</p>}
              <div className="flex flex-wrap items-center gap-2.5">
                {!followed && (
                  <Button
                    variant="secondary"
                    disabled={!canResume(path)}
                    onClick={() => run(window.api.paths.resume(path.id))}
                  >
                    {t('saved.resume')}
                  </Button>
                )}
                {confirming === path.id ? (
                  <>
                    <Button variant="danger" onClick={() => run(window.api.paths.delete(path.id))}>
                      {t('saved.delete.confirm')}
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirming(null)}>
                      {t('saved.delete.cancel')}
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirming(path.id)}>
                    {t('saved.delete')}
                  </Button>
                )}
              </div>
              {!followed && !canResume(path) && (
                <p className="text-[0.8125rem] text-mut">{t('saved.missingSkill')}</p>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function FailedNote(): React.JSX.Element {
  return (
    <p role="alert" className="text-bad-text">
      {t('saved.failed')}
    </p>
  )
}
