import { useCallback, useEffect, useRef, useState } from 'react'
import { CalibrationFlow, type CalibrationState } from '@renderer/core/calibrationFlow'
import type { PoseFrame } from '@renderer/core/detectionLoop'
import { evaluateFraming, type CheckState, type FramingReport } from '@renderer/core/framing'
import type { Landmark } from '@renderer/core/landmarks'
import { sampleLuminance } from '@renderer/core/lighting'
import { localize, t, type MessageKey } from '@renderer/i18n'
import { CameraStage } from '../CameraStage'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'
import { useSkills } from '../skillsStore'

const LUMINANCE_EVERY_MS = 500

const INSTRUCTION: Record<NonNullable<FramingReport['instruction']>, MessageKey> = {
  stepIntoView: 'calibration.instruction.stepIntoView',
  showFullBody: 'calibration.instruction.showFullBody',
  moveBack: 'calibration.instruction.moveBack',
  moveCloser: 'calibration.instruction.moveCloser',
  turnSideways: 'calibration.instruction.turnSideways',
  moreLight: 'calibration.instruction.moreLight'
}

const CHECKS: ReadonlyArray<{ id: keyof Omit<FramingReport, 'instruction'>; label: MessageKey }> = [
  { id: 'fullBody', label: 'calibration.check.fullBody' },
  { id: 'profile', label: 'calibration.check.profile' },
  { id: 'distance', label: 'calibration.check.distance' },
  { id: 'lighting', label: 'calibration.check.lighting' }
]

// Never colour alone: every state also has its own symbol and its own words.
const STATE: Record<CheckState, { symbol: string; label: MessageKey }> = {
  pending: { symbol: '…', label: 'calibration.state.pending' },
  ok: { symbol: '✓', label: 'calibration.state.ok' },
  fix: { symbol: '✗', label: 'calibration.state.fix' }
}

const WAITING: FramingReport = {
  fullBody: 'pending',
  profile: 'pending',
  distance: 'pending',
  lighting: 'pending',
  instruction: 'stepIntoView'
}

const sameReport = (a: FramingReport, b: FramingReport): boolean =>
  a.fullBody === b.fullBody &&
  a.profile === b.profile &&
  a.distance === b.distance &&
  a.lighting === b.lighting &&
  a.instruction === b.instruction

const sameCountdown = (a: CalibrationState, b: CalibrationState): boolean =>
  a.phase === b.phase &&
  (a.phase !== 'countdown' || (b.phase === 'countdown' && a.remaining === b.remaining))

export function CalibrationScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const skillId = useSession((state) => state.skillId)
  const skills = useSkills((state) => state.skills)
  const skill = skills.find((candidate) => candidate.id === skillId)

  const flowRef = useRef(new CalibrationFlow())
  const luminanceRef = useRef<{ value: number | null; at: number }>({ value: null, at: -Infinity })
  const [report, setReport] = useState<FramingReport>(WAITING)
  const [countdown, setCountdown] = useState<CalibrationState>({ phase: 'checking' })

  const handleFrame = useCallback(
    (frame: PoseFrame, landmarks: Landmark[] | null, video: HTMLVideoElement) => {
      if (!skill) return
      const light = luminanceRef.current
      if (frame.timestampMs - light.at >= LUMINANCE_EVERY_MS) {
        luminanceRef.current = { value: sampleLuminance(video), at: frame.timestampMs }
      }

      const next = evaluateFraming({
        landmarks,
        luminance: luminanceRef.current.value,
        frameSize: { width: video.videoWidth, height: video.videoHeight },
        camera: skill.camera
      })
      const state = flowRef.current.update(next.instruction === null, frame.timestampMs)

      setReport((previous) => (sameReport(previous, next) ? previous : next))
      setCountdown((previous) => (sameCountdown(previous, state) ? previous : state))
    },
    [skill]
  )

  // Without a chosen skill there is nothing to calibrate for.
  useEffect(() => {
    if (!skill) go('home')
  }, [skill, go])

  useEffect(() => {
    if (countdown.phase === 'done') go('training')
  }, [countdown, go])

  if (!skill) return <></>

  const instruction = countdown.phase === 'countdown' ? null : report.instruction

  return (
    <section className="flex w-full flex-col items-center gap-4 p-4">
      <h1 className="text-xl font-semibold">
        {t('screen.calibration.title')} · {localize(skill.name)}
      </h1>

      <CameraStage onFrame={handleFrame} showDevicePicker>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-[6%] left-1/2 w-[28%] -translate-x-1/2 rounded-3xl border-2 border-dashed border-white/60"
        />
      </CameraStage>

      <p role="status" aria-live="polite" className="text-center text-4xl font-bold">
        {countdown.phase === 'countdown'
          ? countdown.remaining
          : instruction
            ? t(INSTRUCTION[instruction])
            : t('calibration.holdStill')}
      </p>

      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-lg">
        {CHECKS.map(({ id, label }) => (
          <li key={id}>
            <span aria-hidden="true">{STATE[report[id]].symbol}</span> {t(label)}
            <span className="sr-only">: {t(STATE[report[id]].label)}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => go('home')}
        className="rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
      >
        {t('calibration.cancel')}
      </button>
    </section>
  )
}
