import { useEffect, useState } from 'react'
import { t } from '@renderer/i18n'

interface Props {
  onStart: (label: string) => void
  onStop: () => void
  getFrameCount: () => number
}

const REFRESH_MS = 250

// Development-only controls to record a movement as a test fixture.
export function RecorderControls({ onStart, onStop, getFrameCount }: Props): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  const [label, setLabel] = useState('recording')
  const [frames, setFrames] = useState(0)

  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setFrames(getFrameCount()), REFRESH_MS)
    return () => clearInterval(timer)
  }, [recording, getFrameCount])

  const toggle = (): void => {
    if (recording) {
      onStop()
      setRecording(false)
    } else {
      setFrames(0)
      onStart(label)
      setRecording(true)
    }
  }

  return (
    <div data-testid="recorder" className="flex items-center gap-2 text-sm text-slate-300">
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        disabled={recording}
        aria-label={t('recorder.label')}
        className="rounded bg-slate-800 px-2 py-1 text-slate-100 disabled:opacity-50"
      />
      <button
        onClick={toggle}
        className="rounded bg-slate-700 px-3 py-1 text-slate-100 hover:bg-slate-600"
      >
        {recording ? t('recorder.stop') : t('recorder.start')}
      </button>
      {recording && <span>{t('recorder.frames', { count: frames })}</span>}
    </div>
  )
}
