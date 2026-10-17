import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AudioFraming,
  type AudioFramingReport,
  type AudioInstruction
} from '@renderer/core/audio/audioFraming'
import type { AudioFeatures } from '@renderer/core/audio/capture'
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
import { LevelMeter } from '../LevelMeter'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'
import { useSkills } from '../skillsStore'
import { useMicrophoneFeatures } from '../useMicrophoneFeatures'

const LUMINANCE_EVERY_MS = 500

type Instruction = FramingInstruction | HandInstruction | AudioInstruction

const INSTRUCTION: Record<Instruction, MessageKey> = {
  stepIntoView: 'calibration.instruction.stepIntoView',
  showFullBody: 'calibration.instruction.showFullBody',
  moveBack: 'calibration.instruction.moveBack',
  moveCloser: 'calibration.instruction.moveCloser',
  turnSideways: 'calibration.instruction.turnSideways',
  moreLight: 'calibration.instruction.moreLight',
  showHands: 'calibration.instruction.showHands',
  showWholeHand: 'calibration.instruction.showWholeHand',
  handsCloser: 'calibration.instruction.handsCloser',
  handsBack: 'calibration.instruction.handsBack',
  waitForMicrophone: 'calibration.instruction.waitForMicrophone',
  measuringRoom: 'calibration.instruction.measuringRoom',
  quietRoom: 'calibration.instruction.quietRoom',
  makeSound: 'calibration.instruction.makeSound',
  louder: 'calibration.instruction.louder',
  tooLoud: 'calibration.instruction.tooLoud'
}

interface Check {
  id: string
  label: MessageKey
  state: CheckState
}

// What the screen shows: the checks that apply to the skill and the one thing to fix first.
interface Report {
  checks: Check[]
  instruction: Instruction | null
}

// Never colour alone: every state also has its own symbol and its own words.
const STATE: Record<CheckState, { symbol: string; label: MessageKey }> = {
  pending: { symbol: '…', label: 'calibration.state.pending' },
  ok: { symbol: '✓', label: 'calibration.state.ok' },
  fix: { symbol: '✗', label: 'calibration.state.fix' }
}

// The latest verdict of each source of the skill. A source the skill does not use stays null.
interface Sources {
  body: FramingReport | null
  hand: HandFramingReport | null
  audio: AudioFramingReport | null
}

function bodyChecks(report: FramingReport): Check[] {
  return [
    { id: 'fullBody', label: 'calibration.check.fullBody', state: report.fullBody },
    { id: 'profile', label: 'calibration.check.profile', state: report.profile },
    { id: 'distance', label: 'calibration.check.distance', state: report.distance },
    { id: 'lighting', label: 'calibration.check.lighting', state: report.lighting }
  ]
}

function handChecks(report: HandFramingReport, withLighting: boolean): Check[] {
  const checks: Check[] = [
    { id: 'hands', label: 'calibration.check.hands', state: report.hands },
    { id: 'handDistance', label: 'calibration.check.distance', state: report.distance }
  ]
  if (withLighting) {
    checks.push({ id: 'handLighting', label: 'calibration.check.lighting', state: report.lighting })
  }
  return checks
}

function audioChecks(report: AudioFramingReport): Check[] {
  return [
    { id: 'noise', label: 'calibration.check.noise', state: report.noise },
    { id: 'sound', label: 'calibration.check.sound', state: report.sound }
  ]
}

// Everything together; lighting is the same one for the body and the hands, so it shows once.
function combine({ body, hand, audio }: Sources): Report {
  return {
    checks: [
      ...(body ? bodyChecks(body) : []),
      ...(hand ? handChecks(hand, !body) : []),
      ...(audio ? audioChecks(audio) : [])
    ],
    instruction: body?.instruction ?? hand?.instruction ?? audio?.instruction ?? null
  }
}

// Before the first frame nothing is known yet: every check waits, and there is somebody to wait for.
function waitingSources(useBody: boolean, useHands: boolean, useAudio: boolean): Sources {
  return {
    body: useBody
      ? {
          fullBody: 'pending',
          profile: 'pending',
          distance: 'pending',
          lighting: 'pending',
          instruction: 'stepIntoView'
        }
      : null,
    hand: useHands
      ? {
          hands: 'pending',
          distance: 'pending',
          lighting: 'pending',
          instruction: useBody ? null : 'showHands'
        }
      : null,
    audio: useAudio ? new AudioFraming().waiting() : null
  }
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
  const useAudio = channels.includes('audio')
  const useCamera = useBody || useHands

  const flowRef = useRef(new CalibrationFlow())
  const audioFramingRef = useRef(new AudioFraming())
  const luminanceRef = useRef<{ value: number | null; at: number }>({ value: null, at: -Infinity })
  const [waiting] = useState(() => waitingSources(useBody, useHands, useAudio))
  const sourcesRef = useRef<Sources>(waiting)
  const [report, setReport] = useState<Report>(() => combine(waiting))
  const [countdown, setCountdown] = useState<CalibrationState>({ phase: 'checking' })
  const [levelDb, setLevelDb] = useState(-100)

  // Puts what the sources say together, and moves the countdown on.
  const publish = useCallback((nowMs: number) => {
    const next = combine(sourcesRef.current)
    const state = flowRef.current.update(next.instruction === null, nowMs)
    setReport((previous) => (sameReport(previous, next) ? previous : next))
    setCountdown((previous) => (sameCountdown(previous, state) ? previous : state))
  }, [])

  const handleFrame = useCallback(
    (frame: PoseFrame, landmarks: Landmark[] | null, video: HTMLVideoElement) => {
      if (!skill) return
      const light = luminanceRef.current
      if (frame.timestampMs - light.at >= LUMINANCE_EVERY_MS) {
        luminanceRef.current = { value: sampleLuminance(video), at: frame.timestampMs }
      }
      const luminance = luminanceRef.current.value
      const frameSize = { width: video.videoWidth, height: video.videoHeight }

      sourcesRef.current = {
        ...sourcesRef.current,
        body: useBody
          ? evaluateFraming({ landmarks, luminance, frameSize, camera: cameraOf(skill) })
          : null,
        hand: useHands
          ? evaluateHandFraming({
              hands: frame.hands?.observations ?? [],
              preference: cameraOf(skill).hand,
              luminance,
              frameSize
            })
          : null
      }
      publish(frame.timestampMs)
    },
    [skill, useBody, useHands, publish]
  )

  const handleSound = useCallback(
    (features: AudioFeatures) => {
      const now = performance.now()
      sourcesRef.current = {
        ...sourcesRef.current,
        audio: audioFramingRef.current.update(now, features.levelDb, features.peak)
      }
      setLevelDb(features.levelDb)
      publish(now)
    },
    [publish]
  )

  const microphone = useMicrophoneFeatures(useAudio, handleSound)

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

      {useCamera && (
        <CameraStage onFrame={handleFrame} showDevicePicker withHands={useHands}>
          {useBody && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-[6%] left-1/2 w-[28%] -translate-x-1/2 rounded-3xl border-2 border-dashed border-white/60"
            />
          )}
        </CameraStage>
      )}

      {useAudio && microphone.status === 'listening' && <LevelMeter levelDb={levelDb} />}
      {useAudio && microphone.status === 'error' && (
        <div role="alert" className="flex flex-col items-center gap-2">
          <p>{t(microphone.errorMessage ?? 'microphone.error.unknown')}</p>
          <button
            type="button"
            onClick={microphone.retry}
            className="rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
          >
            {t('calibration.retry')}
          </button>
        </div>
      )}

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
