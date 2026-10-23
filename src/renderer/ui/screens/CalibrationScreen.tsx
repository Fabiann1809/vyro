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
import {
  evaluateObjectFraming,
  type ObjectFramingReport,
  type ObjectInstruction
} from '@renderer/core/objectFraming'
import { sampleLuminance } from '@renderer/core/lighting'
import { localize, t, type MessageKey } from '@renderer/i18n'
import { cameraOf } from '@shared/skill/cameraOf'
import { GUITAR_POSTURE_ID, isGuitarLesson } from '@shared/skill/guitar'
import { skillChannels, skillInstrument, type SkillChannel } from '@shared/skill/skillChannels'
import { CameraStage } from '../CameraStage'
import { ChecksPanel, type CheckItem } from '../immersive/ChecksPanel'
import { Button } from '../kit/Button'
import { Icon } from '../kit/Icon'
import { LevelMeter } from '../LevelMeter'
import { returnTarget, useNavigation } from '../navigation'
import { SkillGuide } from '../route/SkillGuide'
import { useSession } from '../sessionStore'
import { useSkills } from '../skillsStore'
import { useMicrophoneFeatures } from '../useMicrophoneFeatures'

const LUMINANCE_EVERY_MS = 500

type Instruction = FramingInstruction | HandInstruction | ObjectInstruction | AudioInstruction

const INSTRUCTION: Record<Instruction, MessageKey> = {
  stepIntoView: 'calibration.instruction.stepIntoView',
  showFullBody: 'calibration.instruction.showFullBody',
  showUpperBody: 'calibration.instruction.showUpperBody',
  moveBack: 'calibration.instruction.moveBack',
  moveCloser: 'calibration.instruction.moveCloser',
  turnSideways: 'calibration.instruction.turnSideways',
  moreLight: 'calibration.instruction.moreLight',
  lessLight: 'calibration.instruction.lessLight',
  showHands: 'calibration.instruction.showHands',
  showWholeHand: 'calibration.instruction.showWholeHand',
  handsCloser: 'calibration.instruction.handsCloser',
  handsBack: 'calibration.instruction.handsBack',
  showObject: 'calibration.instruction.showObject',
  showWholeObject: 'calibration.instruction.showWholeObject',
  objectCloser: 'calibration.instruction.objectCloser',
  objectBack: 'calibration.instruction.objectBack',
  waitForMicrophone: 'calibration.instruction.waitForMicrophone',
  measuringRoom: 'calibration.instruction.measuringRoom',
  quietRoom: 'calibration.instruction.quietRoom',
  makeSound: 'calibration.instruction.makeSound',
  louder: 'calibration.instruction.louder',
  tooLoud: 'calibration.instruction.tooLoud',
  otherSound: 'calibration.instruction.otherSound'
}

// What the screen shows: the checks that apply to the skill and the one thing to fix first.
interface Report {
  checks: CheckItem[]
  instruction: Instruction | null
}

// The latest verdict of each source of the skill. A source the skill does not use stays null.
interface Sources {
  body: FramingReport | null
  hand: HandFramingReport | null
  object: ObjectFramingReport | null
  audio: AudioFramingReport | null
}

const check = (
  channel: SkillChannel,
  id: string,
  label: MessageKey,
  state: CheckState
): CheckItem => ({ id, label, state, channel })

function bodyChecks(report: FramingReport, fullBody: boolean): CheckItem[] {
  return [
    check(
      'body',
      'fullBody',
      fullBody ? 'calibration.check.fullBody' : 'calibration.check.upperBody',
      report.fullBody
    ),
    check('body', 'profile', 'calibration.check.profile', report.profile),
    check('body', 'distance', 'calibration.check.distance', report.distance),
    check('body', 'lighting', 'calibration.check.lighting', report.lighting)
  ]
}

function handChecks(report: HandFramingReport, withLighting: boolean): CheckItem[] {
  const checks = [
    check('hands', 'hands', 'calibration.check.hands', report.hands),
    check('hands', 'handDistance', 'calibration.check.distance', report.distance)
  ]
  if (withLighting) {
    checks.push(check('hands', 'handLighting', 'calibration.check.lighting', report.lighting))
  }
  return checks
}

function objectChecks(report: ObjectFramingReport): CheckItem[] {
  return [
    check('object', 'object', 'calibration.check.object', report.object),
    check('object', 'objectDistance', 'calibration.check.distance', report.distance)
  ]
}

function audioChecks(report: AudioFramingReport): CheckItem[] {
  return [
    check('audio', 'noise', 'calibration.check.noise', report.noise),
    check('audio', 'sound', 'calibration.check.sound', report.sound)
  ]
}

// Everything together; lighting is the same one for the body and the hands, so it shows once.
function combine({ body, hand, object, audio }: Sources, fullBody: boolean): Report {
  return {
    checks: [
      ...(body ? bodyChecks(body, fullBody) : []),
      ...(hand ? handChecks(hand, !body) : []),
      ...(object ? objectChecks(object) : []),
      ...(audio ? audioChecks(audio) : [])
    ],
    instruction:
      body?.instruction ?? hand?.instruction ?? object?.instruction ?? audio?.instruction ?? null
  }
}

// Before the first frame nothing is known yet: every check waits, and there is somebody to wait for.
function waitingSources(
  useBody: boolean,
  useHands: boolean,
  useObject: boolean,
  useAudio: boolean
): Sources {
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
    object: useObject
      ? {
          object: 'pending',
          distance: 'pending',
          instruction: useBody || useHands ? null : 'showObject'
        }
      : null,
    audio: useAudio ? new AudioFraming().waiting() : null
  }
}

const sameReport = (a: Report, b: Report): boolean =>
  a.instruction === b.instruction &&
  a.checks.length === b.checks.length &&
  a.checks.every((item, index) => item.state === b.checks[index]?.state)

const sameCountdown = (a: CalibrationState, b: CalibrationState): boolean =>
  a.phase === b.phase &&
  (a.phase !== 'countdown' || (b.phase === 'countdown' && a.remaining === b.remaining))

export function CalibrationScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const previous = useNavigation((state) => state.previous)
  const skillId = useSession((state) => state.skillId)
  const selectSkill = useSession((state) => state.selectSkill)
  const skills = useSkills((state) => state.skills)
  const skill = skills.find((candidate) => candidate.id === skillId)
  const channels = skill ? skillChannels(skill) : []
  const useBody = channels.includes('body')
  const useHands = channels.includes('hands')
  const useObject = channels.includes('object')
  const useAudio = channels.includes('audio')
  // The instrument the skill asks to hear, when it does.
  const wanted = skill ? skillInstrument(skill) : null
  const useCamera = useBody || useHands || useObject
  const wholeBody = skill ? cameraOf(skill).fullBody : true

  // A guitar lesson is better after the posture; it only says so, and only until the posture has been done.
  const [postureMissing, setPostureMissing] = useState(false)
  const lessonNeedsPosture =
    skill !== undefined &&
    isGuitarLesson(skill) &&
    skills.some((candidate) => candidate.id === GUITAR_POSTURE_ID)

  const flowRef = useRef(new CalibrationFlow())
  const audioFramingRef = useRef(new AudioFraming())
  const luminanceRef = useRef<{ value: number | null; at: number }>({ value: null, at: -Infinity })
  const [waiting] = useState(() => waitingSources(useBody, useHands, useObject, useAudio))
  const sourcesRef = useRef<Sources>(waiting)
  const [report, setReport] = useState<Report>(() => combine(waiting, wholeBody))
  const [countdown, setCountdown] = useState<CalibrationState>({ phase: 'checking' })
  const [levelDb, setLevelDb] = useState(-100)

  // Puts what the sources say together, and moves the countdown on.
  const publish = useCallback(
    (nowMs: number) => {
      const next = combine(sourcesRef.current, wholeBody)
      const state = flowRef.current.update(next.instruction === null, nowMs)
      setReport((current) => (sameReport(current, next) ? current : next))
      setCountdown((current) => (sameCountdown(current, state) ? current : state))
    },
    [wholeBody]
  )

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
          : null,
        object: useObject ? evaluateObjectFraming(frame.objects?.box ?? null) : null
      }
      publish(frame.timestampMs)
    },
    [skill, useBody, useHands, useObject, publish]
  )

  const handleSound = useCallback(
    (features: AudioFeatures) => {
      const now = performance.now()
      sourcesRef.current = {
        ...sourcesRef.current,
        audio: audioFramingRef.current.update(
          now,
          features.levelDb,
          features.peak,
          // Not classified (no model): any sound will do.
          wanted === null || features.heardInstrument === undefined
            ? null
            : features.heardInstrument === wanted
        )
      }
      setLevelDb(features.levelDb)
      publish(now)
    },
    [publish, wanted]
  )

  const microphone = useMicrophoneFeatures(useAudio, handleSound, undefined, wanted !== null)

  const cancel = useCallback(() => go(returnTarget(previous)), [go, previous])

  useEffect(() => {
    if (!lessonNeedsPosture) return
    let cancelled = false
    window.api.sessions
      .list({ skillId: GUITAR_POSTURE_ID, limit: 1 })
      .then((rows) => {
        if (!cancelled) setPostureMissing(rows.length === 0)
      })
      // If the history cannot be read, saying nothing is better than a wrong notice.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [lessonNeedsPosture])

  // Without a chosen skill there is nothing to calibrate for.
  useEffect(() => {
    if (!skill) go('library')
  }, [skill, go])

  useEffect(() => {
    if (countdown.phase === 'done') go('training')
  }, [countdown, go])

  // Escape leaves, for the person who is standing away from the mouse.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  if (!skill) return <></>

  const counting = countdown.phase === 'countdown'
  const instruction = counting ? null : report.instruction
  const spoken = counting
    ? String(countdown.remaining)
    : instruction
      ? t(INSTRUCTION[instruction], wanted ? { instrument: t(`instrument.${wanted}.a`) } : {})
      : t('calibration.holdStill')

  // What is said to the person, once, in one place: it is read out as it changes.
  const status = (
    <p
      role="status"
      aria-live="polite"
      className={
        counting ? 'sr-only' : 'text-center text-4xl leading-tight font-semibold text-balance'
      }
    >
      {spoken}
    </p>
  )

  const problem = useAudio && microphone.status === 'error' && (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-3xl border border-bad/40 bg-bad/8 p-5 text-center"
    >
      <p>{t(microphone.errorMessage ?? 'microphone.error.unknown')}</p>
      <Button variant="secondary" onClick={microphone.retry}>
        {t('calibration.retry')}
      </Button>
    </div>
  )

  return (
    <section className="force-dark anim-fade flex h-full w-full flex-col gap-4 bg-[#07080b] px-6.5 pt-5 pb-6 text-t1">
      <header className="flex items-center justify-between gap-5">
        <div className="flex items-center gap-3.5">
          <h1 className="text-[0.9375rem] text-t4">
            {t('screen.calibration.title')} ·{' '}
            <span className="font-semibold text-t1">{localize(skill.name)}</span>
          </h1>
          <span className="rounded-full bg-line/6 px-2.5 py-1 text-xs text-t4">
            {t('calibration.phase')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {useAudio && (
            <span className="flex h-9 items-center gap-2 rounded-full bg-line/5 px-3.5 text-[0.8125rem] text-t4">
              <Icon name="mic" className="size-3.5" strokeWidth={1.4} />
              {t('training.privacyAudio')}
            </span>
          )}
          <Button variant="secondary" aria-keyshortcuts="Escape" onClick={cancel}>
            {t('calibration.cancel')} · Esc
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-5">
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[1.875rem] bg-sunk">
          {useCamera ? (
            <CameraStage
              onFrame={handleFrame}
              showDevicePicker
              withHands={useHands}
              withObjects={useObject}
              videoClassName="max-h-[74vh] rounded-[1.875rem]"
            >
              {useBody && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-[6%] left-1/2 w-[28%] -translate-x-1/2 rounded-3xl border-2 border-dashed border-white/60"
                />
              )}
            </CameraStage>
          ) : (
            <div className="flex w-full max-w-xl flex-col items-center gap-6 p-8">
              {microphone.status === 'listening' && <LevelMeter levelDb={levelDb} />}
              {problem}
              {status}
            </div>
          )}

          {/* What is said to the person does not depend on the camera: with none, it still shows. */}
          {useCamera && counting && (
            <div
              aria-hidden="true"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-bg/55"
            >
              <p
                key={countdown.remaining}
                className="anim-beat font-display text-[13.75rem] leading-none font-bold"
              >
                {countdown.remaining}
              </p>
              <p className="text-2xl text-t4">{t('calibration.get.ready')}</p>
            </div>
          )}
          {useCamera && (
            <div
              className={
                counting
                  ? 'sr-only'
                  : 'absolute right-6 bottom-6 left-6 rounded-3xl bg-bg/85 px-7.5 py-4.5'
              }
            >
              {status}
            </div>
          )}
        </div>

        <div className="flex w-95 shrink-0 flex-col gap-3.5 overflow-y-auto">
          {lessonNeedsPosture && postureMissing && (
            <div className="flex flex-col items-start gap-3 rounded-3xl border border-line/6 bg-card p-5">
              <p>{t('calibration.posture.notice')}</p>
              <Button variant="secondary" onClick={() => selectSkill(GUITAR_POSTURE_ID)}>
                {t('calibration.posture.go')}
              </Button>
            </div>
          )}
          <ChecksPanel checks={report.checks} />
          {skill.guide && <SkillGuide guide={skill.guide} open={false} />}
          {useCamera &&
            useAudio &&
            (microphone.status === 'listening' || microphone.status === 'error') && (
              <div className="rounded-3xl border border-line/6 bg-card p-5">
                {microphone.status === 'listening' && <LevelMeter levelDb={levelDb} />}
                {problem}
              </div>
            )}
        </div>
      </div>
    </section>
  )
}
