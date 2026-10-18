import { useEffect, useState } from 'react'
import { t } from '@renderer/i18n'
import type { CurrentPath } from '@shared/pathProgress'
import { ActivePath } from '../ActivePath'
import { focusComposer } from '../focusComposer'
import { startOver } from '../homeChatStore'
import { Button } from '../kit/Button'
import { CoachAvatar } from '../kit/CoachAvatar'
import { useNavigation } from '../navigation'
import { SavedPaths } from '../route/SavedPaths'

// Back to the chat, empty and with the cursor in the box, to ask the coach for a path.
function useAskForPath(): () => void {
  const go = useNavigation((state) => state.go)
  return () => {
    startOver()
    go('home')
    focusComposer()
  }
}

export function PathScreen(): React.JSX.Element {
  const askForPath = useAskForPath()
  // undefined while it is being loaded; null when there is no path being followed.
  const [current, setCurrent] = useState<CurrentPath | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  // Bumped to read the path again after it changes.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    window.api.paths
      .getCurrent()
      .then((found) => {
        if (!cancelled) setCurrent(found)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [version])

  if (failed) return <p role="alert">{t('path.loadFailed')}</p>
  if (current === undefined) return <p role="status">{t('path.loading')}</p>

  if (current === null) {
    return (
      <section className="flex h-full w-full flex-col items-center justify-center gap-5 px-8 text-center">
        <CoachAvatar size={72} />
        <h1 className="font-display text-[2.125rem] leading-tight font-semibold tracking-tight">
          {t('screen.path.title')}
        </h1>
        <p className="max-w-md text-lg text-mut text-pretty">{t('route.empty.body')}</p>
        <Button size="lg" onClick={askForPath}>
          {t('route.empty.cta')}
        </Button>
        <div className="w-full max-w-md text-left">
          <SavedPaths version={version} onChanged={() => setVersion((value) => value + 1)} />
        </div>
      </section>
    )
  }

  return (
    <ActivePath
      current={current}
      version={version}
      onChanged={() => setVersion((value) => value + 1)}
      onNewPath={askForPath}
    />
  )
}
