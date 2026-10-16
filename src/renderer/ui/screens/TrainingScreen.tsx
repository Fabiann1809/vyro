import { useCallback, useEffect, useRef, useState } from 'react'
import type { PoseFrame } from '@renderer/core/detectionLoop'
import type { Landmark } from '@renderer/core/landmarks'
import type { FeedbackMessage } from '@renderer/engine/feedback'
import type { RepQuality } from '@renderer/engine/repEvaluator'
import { TrainingRun, type TrainingSnapshot } from '@renderer/engine/trainingRun'
import { localize, t, type MessageKey } from '@renderer/i18n'
import { bundledSkills } from '@renderer/skills'
import { CameraStage } from '../CameraStage'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'

const MESSAGE_VISIBLE_MS = 4000

const PHASE_LABEL: Record<string, MessageKey> = {
  up: 'training.phase.up',
  down: 'training.phase.down',
  extended: 'training.phase.extended',
  curled: 'training.phase.curled'
}

const PRAISE: readonly MessageKey[] = [
  'training.praise.0',
  'training.praise.1',
  'training.praise.2'
]

// Never colour alone: each quality has its own symbol and its own words.
const QUALITY: Partial<Record<RepQuality, { symbol: string; label: MessageKey }>> = {
  good: { symbol: '✓', label: 'training.quality.good' },
  'needs-work': { symbol: '!', label: 'training.quality.needsWork' },
  bad: { symbol: '✗', label: 'training.quality.bad' }
}

const EMPTY: TrainingSnapshot = {
  repCount: 0,
  phase: null,
  lastQuality: null,
  tracking: 'tracking',
  feedback: null
}

interface Banner {
  id: number
  text: string
  praise: boolean
}

function bannerOf(message: FeedbackMessage, id: number): Banner {
  return message.kind === 'praise'
    ? { id, text: t(PRAISE[message.variant % PRAISE.length] ?? 'training.praise.0'), praise: true }
    : { id, text: localize(message.message), praise: false }
}

const clock = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function TrainingScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const skillId = useSession((state) => state.skillId)
  const finishSession = useSession((state) => state.finishSession)
  const skill = bundledSkills.skills.find((candidate) => candidate.id === skillId)

  const runRef = useRef<TrainingRun | null>(null)
  const bannerId = useRef(0)
  const [snapshot, setSnapshot] = useState<TrainingSnapshot>(EMPTY)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [paused, setPaused] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  const handleFrame = useCallback(
    (frame: PoseFrame, _smoothed: Landmark[] | null, video: HTMLVideoElement) => {
      if (!skill) return
      // The engine smooths on its own, so it gets the raw landmarks.
      runRef.current ??= new TrainingRun(skill, {
        width: video.videoWidth,
        height: video.videoHeight
      })
      const next = runRef.current.processFrame({
        timestampMs: frame.timestampMs,
        landmarks: frame.landmarks
      })

      if (next.feedback) setBanner(bannerOf(next.feedback, ++bannerId.current))
      setSnapshot((previous) =>
        previous.repCount === next.repCount &&
        previous.phase === next.phase &&
        previous.lastQuality === next.lastQuality &&
        previous.tracking === next.tracking
          ? previous
          : next
      )
    },
    [skill]
  )

  const togglePause = useCallback(() => {
    const run = runRef.current
    if (!run) return
    if (run.paused) run.resume()
    else run.pause()
    setPaused(run.paused)
  }, [])

  const end = useCallback(() => {
    if (skill) {
      finishSession({
        skillId: skill.id,
        durationMs: elapsedMs,
        results: runRef.current?.results ?? []
      })
    }
    go('summary')
  }, [skill, elapsedMs, finishSession, go])

  useEffect(() => {
    if (!skill) go('home')
  }, [skill, go])

  // The stopwatch only runs while the session does.
  useEffect(() => {
    if (paused || snapshot.tracking === 'lost') return
    const timer = setInterval(() => setElapsedMs((ms) => ms + 1000), 1000)
    return () => clearInterval(timer)
  }, [paused, snapshot.tracking])

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), MESSAGE_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [banner])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.toLowerCase() === 'p') togglePause()
      if (event.key.toLowerCase() === 'f') end()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePause, end])

  if (!skill) return <></>

  const quality = snapshot.lastQuality ? QUALITY[snapshot.lastQuality] : undefined
  const phaseKey = snapshot.phase ? PHASE_LABEL[snapshot.phase] : undefined

  return (
    <section className="flex h-full w-full flex-col gap-3 p-4">
      <header className="flex items-center gap-4 text-sm">
        <span>{t('training.privacy')}</span>
        <span className="ml-auto tabular-nums">{clock(elapsedMs)}</span>
        <button
          type="button"
          aria-keyshortcuts="P"
          onClick={togglePause}
          className="rounded-md bg-slate-200 px-5 py-3 text-base dark:bg-slate-800"
        >
          {paused ? t('training.resume') : t('training.pause')}
        </button>
        <button
          type="button"
          aria-keyshortcuts="F"
          onClick={end}
          className="ml-6 rounded-md bg-red-700 px-5 py-3 text-base text-white"
        >
          {t('training.end')}
        </button>
      </header>

      <div className="flex flex-1 items-start justify-center gap-6">
        <div className="relative">
          <CameraStage onFrame={handleFrame} videoClassName="max-h-[70vh]">
            {(paused || snapshot.tracking === 'lost') && (
              <div
                role="alert"
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/70 text-center text-white"
              >
                <p className="text-3xl font-bold">
                  {paused ? t('training.paused') : t('training.lost')}
                </p>
                {!paused && (
                  <button
                    type="button"
                    onClick={() => go('calibration')}
                    className="rounded-md bg-white px-4 py-2 text-slate-900"
                  >
                    {t('training.recalibrate')}
                  </button>
                )}
              </div>
            )}
          </CameraStage>
        </div>

        <aside className="flex w-64 flex-col gap-4 text-center">
          <p className="text-xl">{localize(skill.name)}</p>
          <p className="text-9xl font-bold tabular-nums" aria-live="polite">
            {snapshot.repCount}
          </p>
          <p>{t('training.reps')}</p>
          <p className="text-2xl">{phaseKey ? t(phaseKey) : ' '}</p>
          <p className="text-xl">
            {t('training.last')}{' '}
            {quality ? (
              <>
                <span aria-hidden="true">{quality.symbol}</span> {t(quality.label)}
              </>
            ) : (
              '—'
            )}
          </p>
        </aside>
      </div>

      <div
        role="status"
        aria-live="assertive"
        className="min-h-20 rounded-lg bg-slate-200 p-4 text-center text-3xl font-semibold transition-opacity motion-reduce:transition-none dark:bg-slate-800"
        style={{ opacity: banner ? 1 : 0 }}
      >
        {banner && (
          <>
            <span aria-hidden="true">{banner.praise ? '★' : '⚠'}</span> {banner.text}
          </>
        )}
      </div>
    </section>
  )
}
