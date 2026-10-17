import { useCallback, useEffect, useRef, useState } from 'react'
import { CalibrationFlow, type CalibrationState } from '@renderer/core/calibrationFlow'
import type { PoseFrame } from '@renderer/core/detectionLoop'
import {
  evaluateFraming,
  type CheckState,
  type FramingInstruction,
  type FramingReport
} from '@renderer/core/framing'
import {
  evaluateHandFraming,
  type HandFramingReport,
  type HandInstruction
} from '@renderer/core/handFraming'
import type { Landmark } from '@renderer/core/landmarks'
import { sampleLuminance } from '@renderer/core/lighting'
import { localize, t, type MessageKey } from '@renderer/i18n'
import { cameraOf } from '@shared/skill/cameraOf'
import { skillChannels } from '@shared/skill/skillChannels'
import { CameraStage } from '../CameraStage'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'
import { useSkills } from '../skillsStore'

const LUMINANCE_EVERY_MS = 500

const INSTRUCTION: Record<FramingInstruction | HandInstruction, MessageKey> = {
  stepIntoView: 'calibration.instruction.stepIntoView',
  showFullBody: 'calibration.instruction.showFullBody',
  moveBack: 'calibration.instruction.moveBack',
  moveCloser: 'calibration.instruction.moveCloser',
  turnSideways: 'calibration.instruction.turnSideways',
  moreLight: 'calibration.instruction.moreLight',
  showHands: 'calibration.instruction.showHands',
  showWholeHand: 'calibration.instruction.showWholeHand',
  handsCloser: 'calibration.instruction.handsCloser',
  handsBack: 'calibration.instruction.handsBack'
}

interface Check {
  id: string
  label: MessageKey
  state: CheckState
}

// What the screen shows: the checks that apply to the skill and the one thing to fix first.
interface Report {
  checks: Check[]
  instruction: FramingInstruction | HandInstruction | null
}

// Never colour alone: every state also has its own symbol and its own words.
const STATE: Record<CheckState, { symbol: string; label: MessageKey }> = {
  pending: { symbol: '…', label: 'calibration.state.pending' },
  ok: { symbol: '✓', label: 'calibration.state.ok' },
  fix: { symbol: '✗', label: 'calibration.state.fix' }
}

function bodyChecks(report: FramingReport): Check[] {
  return [
    { id: 'fullBody', label: 'calibration.check.fullBody', state: report.fullBody },
    { id: 'profile', label: 'calibration.check.profile', state: report.profile },
    { id: 'distance', label: 'calibration.check.distance', state: report.distance },
    { id: 'lighting', label: 'calibration.check.lighting', state: report.lighting }
  ]
}

function handChecks(report: HandFramingReport): Check[] {
  return [
    { id: 'hands', label: 'calibration.check.hands', state: report.hands },
    { id: 'handDistance', label: 'calibration.check.distance', state: report.distance },
    { id: 'handLighting', label: 'calibration.check.lighting', state: report.lighting }
  ]
}

// Both together for a skill of the body and the hands; lighting is the same one, so it shows once.
function combine(body: FramingReport | null, hand: HandFramingReport | null): Report {
  const checks = [
    ...(body ? bodyChecks(body) : []),
    ...(hand ? handChecks(hand).filter((check) => !body || check.id !== 'handLighting') : [])
  ]
  return { checks, instruction: body?.instruction ?? hand?.instruction ?? null }
}

// Before the first frame nothing is known yet: every check waits, and there is somebody to wait for.
function waitingReport(useBody: boolean, useHands: boolean): Report {
  const report = combine(
    useBody
      ? {
          fullBody: 'pending',
          profile: 'pending',
          distance: 'pending',
          lighting: 'pending',
          instruction: null
        }
      : null,
    useHands
      ? { hands: 'pending', distance: 'pending', lighting: 'pending', instruction: null }
      : null
  )
  return { ...report, instruction: useBody ? 'stepIntoView' : 'showHands' }
}

const sameReport = (a: Report, b: Report): boolean =>
  a.instruction === b.instruction &&
  a.checks.length === b.checks.length &&
  a.checks.every((check, index) => check.state === b.checks[index]?.state)

const sameCountdown = (a: CalibrationState, b: CalibrationState): boolean =>
  a.phase === b.phase &&
  (a.phase !== 'countdown' || (b.phase === 'countdown' && a.remaining === b.remaining))

export function CalibrationScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const skillId = useSession((state) => state.skillId)
  const skills = useSkills((state) => state.skills)
  const skill = skills.find((candidate) => candidate.id === skillId)
  const channels = skill ? skillChannels(skill) : []
  const useBody = channels.includes('body')
  const useHands = channels.includes('hands')

  const flowRef = useRef(new CalibrationFlow())
  const luminanceRef = useRef<{ value: number | null; at: number }>({ value: null, at: -Infinity })
  const [report, setReport] = useState<Report>(() => waitingReport(useBody, useHands))
  const [countdown, setCountdown] = useState<CalibrationState>({ phase: 'checking' })

  const handleFrame = useCallback(
    (frame: PoseFrame, landmarks: Landmark[] | null, video: HTMLVideoElement) => {
      if (!skill) return
      const light = luminanceRef.current
      if (frame.timestampMs - light.at >= LUMINANCE_EVERY_MS) {
        luminanceRef.current = { value: sampleLuminance(video), at: frame.timestampMs }
      }
      const luminance = luminanceRef.current.value
      const frameSize = { width: video.videoWidth, height: video.videoHeight }

      const body = useBody
        ? evaluateFraming({ landmarks, luminance, frameSize, camera: cameraOf(skill) })
        : null
      const hand = useHands
        ? evaluateHandFraming({
            hands: frame.hands?.observations ?? [],
            preference: cameraOf(skill).hand,
            luminance,
            frameSize
          })
        : null
      const next = combine(body, hand)
      const state = flowRef.current.update(next.instruction === null, frame.timestampMs)

      setReport((previous) => (sameReport(previous, next) ? previous : next))
      setCountdown((previous) => (sameCountdown(previous, state) ? previous : state))
    },
    [skill, useBody, useHands]
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

      <CameraStage onFrame={handleFrame} showDevicePicker withHands={useHands}>
        {useBody && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-[6%] left-1/2 w-[28%] -translate-x-1/2 rounded-3xl border-2 border-dashed border-white/60"
          />
        )}
      </CameraStage>

      <p role="status" aria-live="polite" className="text-center text-4xl font-bold">
        {countdown.phase === 'countdown'
          ? countdown.remaining
          : instruction
            ? t(INSTRUCTION[instruction])
            : t('calibration.holdStill')}
      </p>

      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-lg">
        {report.checks.map(({ id, label, state }) => (
          <li key={id}>
            <span aria-hidden="true">{STATE[state].symbol}</span> {t(label)}
            <span className="sr-only">: {t(STATE[state].label)}</span>
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
