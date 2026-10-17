import { useEffect, useState, type RefObject } from 'react'
import { FrameStats, type FrameStatsSnapshot } from '@renderer/core/frameStats'
import { t } from '@renderer/i18n'

const REFRESH_MS = 500

// Development-only readout of how fast the camera and the pose model run.
export function DebugPanel({
  stats,
  handStats,
  objectStats
}: {
  stats: RefObject<FrameStats>
  handStats?: RefObject<FrameStats>
  objectStats?: RefObject<FrameStats>
}): React.JSX.Element | null {
  const [snapshot, setSnapshot] = useState<FrameStatsSnapshot | null>(null)
  const [hands, setHands] = useState<FrameStatsSnapshot | null>(null)
  const [objects, setObjects] = useState<FrameStatsSnapshot | null>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      const now = performance.now()
      setSnapshot(stats.current.snapshot(now))
      if (handStats) setHands(handStats.current.snapshot(now))
      if (objectStats) setObjects(objectStats.current.snapshot(now))
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [stats, handStats, objectStats])

  if (!snapshot) return null

  return (
    <div
      data-testid="debug-panel"
      className="absolute top-2 left-2 rounded bg-black/60 px-2 py-1 font-mono text-xs text-emerald-300"
    >
      <div>{t('debug.camera', { fps: snapshot.cameraFps.toFixed(1) })}</div>
      <div>{t('debug.detection', { fps: snapshot.detectionFps.toFixed(1) })}</div>
      <div>
        {t('debug.latency', {
          avg: snapshot.averageLatencyMs.toFixed(1),
          max: snapshot.maxLatencyMs.toFixed(1)
        })}
      </div>
      {hands && (
        <div>
          {t('debug.hands', {
            fps: hands.detectionFps.toFixed(1),
            avg: hands.averageLatencyMs.toFixed(1)
          })}
        </div>
      )}
      {objects && (
        <div>
          {t('debug.objects', {
            fps: objects.detectionFps.toFixed(1),
            avg: objects.averageLatencyMs.toFixed(1)
          })}
        </div>
      )}
    </div>
  )
}
