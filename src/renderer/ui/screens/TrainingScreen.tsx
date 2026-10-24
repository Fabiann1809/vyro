import { useCallback, useEffect, useRef, useState } from 'react'
import { measureSound, type AudioFeatures } from '@renderer/core/audio/capture'
import { DEFAULT_AUDIO_FRAMING } from '@renderer/core/audio/audioFraming'
import { OtherSoundWatch } from '@renderer/core/audio/otherSoundWatch'
import {
  centsBetween,
  frequencyOfMidi,
  nearestNote,
  noteToMidi,
  type Note
} from '@renderer/core/audio/pitch'
import { skillTargetNote } from '@shared/skill/pitchTarget'
import { InTuneHold, nextUntuned } from '@renderer/core/audio/tuning'
import type { PoseFrame } from '@renderer/core/detectionLoop'
import type { Landmark } from '@renderer/core/landmarks'
import type { FeedbackMessage } from '@renderer/engine/feedback'
import type { RepQuality, RepResult } from '@renderer/engine/repEvaluator'
import { retarget } from '@renderer/engine/retarget'
import type { CompletedRep } from '@renderer/engine/repCounter'
import { buildSessionToSave } from '@renderer/engine/sessionSummary'
import type { FrameInput } from '@renderer/engine/skillSession'
import type { SkillConfig } from '@shared/skill/skillSchema'
import type { FrameSize } from '@renderer/engine/metrics'
import { TrainingRun, type TrainingSnapshot } from '@renderer/engine/trainingRun'
import { localize, t, type MessageKey } from '@renderer/i18n'
import { voice } from '@renderer/voice'
import { sessionNumbers } from '@renderer/engine/sessionSummary'
import type { StatusNotice } from '@renderer/voice/clipList'
import { VoicePolicy } from '@renderer/voice/voicePolicy'
import { HandControl } from '@renderer/core/handControl'
import { pickHand } from '@renderer/core/handJoints'
import { cameraOf } from '@shared/skill/cameraOf'
import { isGeneratedSkillId } from '@shared/skill/generatedSafety'
import { ruleChannel } from '@shared/skill/ruleChannels'
import { skillChannels, skillInstrument, type SkillChannel } from '@shared/skill/skillChannels'
import { CameraStage } from '../CameraStage'
import { CorrectionBand } from '../immersive/CorrectionBand'
import { liveLines, unitLabel } from '../liveProgress'
import { RepCounter } from '../immersive/RepCounter'
import { TargetNote } from '../immersive/TargetNote'
import { StringTuner } from '../immersive/StringTuner'
import { TunerCard } from '../immersive/TunerCard'
import { Button } from '../kit/Button'
import { FinishButton } from '../immersive/FinishButton'
import { useHandPointer } from '../handPointerStore'
import { Icon } from '../kit/Icon'
import { LevelMeter } from '../LevelMeter'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'
import { useSettings } from '../settingsStore'
import { adjustSkillToPerson, type PersonalOutcome } from '../personalSkill'
import { useSkills } from '../skillsStore'
import { phaseLabel } from '../phaseLabel'
import { useMicrophoneFeatures } from '../useMicrophoneFeatures'

const MESSAGE_VISIBLE_MS = 4000

// A pitch is only a note when the sound is clear enough to be sure of it.
const MIN_PITCH_CLARITY = 0.5

// The same clock as the frames of the camera.
const now = (): number => performance.now()

const PERSONAL_RESULT: Record<PersonalOutcome, MessageKey> = {
  saved: 'training.personal.done',
  unchanged: 'training.personal.same',
  failed: 'training.personal.failed'
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
  numbers: sessionNumbers([]),
  feedback: null
}

interface Banner {
  id: number
  text: string
  praise: boolean
  // What a correction is about; null for a praise.
  channel: SkillChannel | null
}

const clock = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function TrainingScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const skillId = useSession((state) => state.skillId)
  const finishSession = useSession((state) => state.finishSession)
  const setSaveStatus = useSession((state) => state.setSaveStatus)
  const skills = useSkills((state) => state.skills)
  const skill = skills.find((candidate) => candidate.id === skillId)

  const runRef = useRef<TrainingRun | null>(null)
  const policyRef = useRef<VoicePolicy | null>(null)
  const bannerId = useRef(0)
  const [startedAt] = useState(() => Date.now())
  const [snapshot, setSnapshot] = useState<TrainingSnapshot>(EMPTY)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  // While true, the next repetition that is completed is the one the skill is adjusted to.
  const [adjusting, setAdjusting] = useState(false)
  const adjustFrom = useRef<CompletedRep | null>(null)
  const [personalResult, setPersonalResult] = useState<PersonalOutcome | null>(null)

  const channels = skill ? skillChannels(skill) : []
  const useCamera =
    channels.includes('body') || channels.includes('hands') || channels.includes('object')
  const useAudio = channels.includes('audio')
  // Pointing a finger at the finish button ends the training without touching the computer.
  const handControl = useSettings((state) => state.handControl) && useCamera
  const handControlRef = useRef<HandControl | null>(null)
  // What the microphone heard last, for the skills that look and listen at once.
  const audioRef = useRef<AudioFeatures | null>(null)
  const [levelDb, setLevelDb] = useState(-100)
  const [note, setNote] = useState<Note | null>(null)
  // The instrument the skill asks to hear, and whether something else has been sounding for a while.
  const wanted = skill ? skillInstrument(skill) : null
  const otherSoundRef = useRef(
    new OtherSoundWatch(DEFAULT_AUDIO_FRAMING.otherSoundMs, DEFAULT_AUDIO_FRAMING.silenceDb)
  )
  const [wrongSound, setWrongSound] = useState(false)

  // A skill shown as a tuner is tuned string by string: each string is a note to aim at.
  const targets = skill?.audio?.targets ?? []
  const tuner = skill?.display === 'tuner' && targets.length > 0
  // A note to play, shown with whether the one that sounds is right.
  const targetNote = skill?.display === 'target-note' && skill ? skillTargetNote(skill) : null
  const [stringIndex, setStringIndex] = useState(0)
  const [tuned, setTuned] = useState<ReadonlySet<number>>(new Set())
  const [targetCents, setTargetCents] = useState<number | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const stringRef = useRef({ index: 0, tuned: new Set<number>() })
  const holdRef = useRef(new InTuneHold())
  // What was judged on the strings already left behind: each string is a run of its own.
  const earlierResults = useRef<RepResult[]>([])

  const bannerOf = (message: FeedbackMessage, id: number): Banner =>
    message.kind === 'praise'
      ? {
          id,
          text: t(PRAISE[message.variant % PRAISE.length] ?? 'training.praise.0'),
          praise: true,
          channel: null
        }
      : {
          id,
          text: localize(message.message),
          praise: false,
          channel: skill ? ruleChannel(skill, message.ruleId) : null
        }

  // The skill aimed at the string being tuned, if it is tuned string by string.
  const aimedSkill = (base: SkillConfig): SkillConfig => {
    const target = targets[stringRef.current.index]
    return tuner && target ? retarget(base, target) : base
  }

  const pickString = (index: number): void => {
    earlierResults.current.push(...(runRef.current?.results ?? []))
    runRef.current = null
    stringRef.current.index = index
    holdRef.current.reset()
    setStringIndex(index)
    setHoldProgress(0)
  }

  // How far the sound is from the note aimed at, or from the nearest note when none is.
  const centsOf = (features: AudioFeatures, a4: number, target: string): number | null => {
    if (features.pitchHz <= 0 || features.pitchClarity < MIN_PITCH_CLARITY) return null
    const midi = noteToMidi(target)
    return midi === null
      ? nearestNote(features.pitchHz, a4).cents
      : centsBetween(features.pitchHz, frequencyOfMidi(midi, a4))
  }

  const followTuning = (features: AudioFeatures): void => {
    const target = targets[stringRef.current.index] ?? ''
    const cents = centsOf(features, skill?.audio?.a4 ?? 440, target)
    setTargetCents(cents)
    const timestamp = now()
    if (holdRef.current.update(timestamp, cents)) {
      const { index } = stringRef.current
      stringRef.current.tuned = new Set(stringRef.current.tuned).add(index)
      setTuned(stringRef.current.tuned)
      const next = nextUntuned(index, stringRef.current.tuned, targets.length)
      if (next !== null) pickString(next)
    }
    setHoldProgress(holdRef.current.progress(timestamp))
  }

  // One step of the session, from the camera, the microphone or both.
  const advance = (input: FrameInput, size: FrameSize): void => {
    if (!skill) return
    // The engine smooths on its own, so it gets the raw landmarks.
    runRef.current ??= new TrainingRun(aimedSkill(skill), size)
    const next = runRef.current.processFrame(input)

    if (next.feedback) {
      setBanner(bannerOf(next.feedback, ++bannerId.current))
      const { voiceEnabled, language, volume } = useSettings.getState()
      policyRef.current ??= new VoicePolicy(voice, skill.id)
      policyRef.current.consider(
        next.feedback,
        { enabled: voiceEnabled, language, volume },
        input.timestampMs
      )
    }
    const rep = runRef.current.lastRep
    if (adjusting && skill && rep && rep !== adjustFrom.current) {
      setAdjusting(false)
      void adjustSkillToPerson(window.api, skill, rep).then((outcome) => {
        setPersonalResult(outcome)
        // The skill changed, so the session goes on with a run that uses the new thresholds.
        if (outcome === 'saved') {
          runRef.current = null
          policyRef.current = null
        }
      })
    }
    setSnapshot((previous) =>
      previous.repCount === next.repCount &&
      previous.phase === next.phase &&
      previous.lastQuality === next.lastQuality &&
      previous.tracking === next.tracking
        ? previous
        : next
    )
  }

  const handleFrame = (
    frame: PoseFrame,
    _smoothed: Landmark[] | null,
    video: HTMLVideoElement
  ): void => {
    if (!skill) return
    if (handControl) {
      handControlRef.current ??= new HandControl()
      const control = handControlRef.current.update(
        frame.hands?.observations ?? [],
        frame.timestampMs
      )
      useHandPointer.getState().show(control.pointer, control.progress)
      if (control.finished) end()
    }
    const hand = pickHand(frame.hands?.observations ?? [], cameraOf(skill).hand)
    advance(
      {
        timestampMs: frame.timestampMs,
        landmarks: frame.landmarks,
        hand: hand?.landmarks ?? null,
        audio: audioRef.current,
        object: frame.objects?.box ?? null
      },
      { width: video.videoWidth, height: video.videoHeight }
    )
  }

  // A skill that only listens has no frames of video: every reading of the sound moves it on.
  const handleSound = (features: AudioFeatures): void => {
    audioRef.current = features
    setLevelDb(features.levelDb)
    setWrongSound(
      otherSoundRef.current.update(
        now(),
        features.levelDb,
        wanted === null || features.heardInstrument === undefined
          ? null
          : features.heardInstrument === wanted
      )
    )
    setNote(
      features.pitchHz > 0 && features.pitchClarity >= MIN_PITCH_CLARITY
        ? nearestNote(features.pitchHz)
        : null
    )
    if (tuner) followTuning(features)
    else if (targetNote) setTargetCents(centsOf(features, skill?.audio?.a4 ?? 440, targetNote))
    if (!useCamera) {
      advance({ timestampMs: now(), landmarks: null, audio: features }, { width: 1, height: 1 })
    }
  }

  const microphone = useMicrophoneFeatures(useAudio, handleSound, measureSound, wanted !== null)

  // Says out loud that the app is not measuring, with the same limits as the other messages.
  const announce = useCallback(
    (notice: StatusNotice): void => {
      if (!skill) return
      const { voiceEnabled, language, volume } = useSettings.getState()
      policyRef.current ??= new VoicePolicy(voice, skill.id)
      policyRef.current.announce(notice, { enabled: voiceEnabled, language, volume }, Date.now())
    },
    [skill]
  )

  const startAdjusting = (): void => {
    adjustFrom.current = runRef.current?.lastRep ?? null
    setPersonalResult(null)
    setAdjusting(true)
  }

  const end = useCallback(() => {
    if (skill) {
      const results = [...earlierResults.current, ...(runRef.current?.results ?? [])]
      finishSession({ skillId: skill.id, startedAt, durationMs: elapsedMs, results })

      const toSave = buildSessionToSave(skill.id, startedAt, elapsedMs, results)
      if (toSave) {
        window.api.sessions
          .save(toSave)
          .then(() => setSaveStatus('saved'))
          .catch(() => setSaveStatus('failed'))
      } else {
        setSaveStatus('nothing-to-save')
      }
    }
    go('summary')
  }, [skill, startedAt, elapsedMs, finishSession, setSaveStatus, go])

  useEffect(() => {
    if (!skill) go('library')
  }, [skill, go])

  // Whatever is being said is cut off when the user leaves the training.
  useEffect(() => () => voice.stop(), [])
  useEffect(() => () => useHandPointer.getState().clear(), [])

  // The stopwatch only runs while the session does.
  useEffect(() => {
    if (snapshot.tracking === 'lost') return
    const timer = setInterval(() => setElapsedMs((ms) => ms + 1000), 1000)
    return () => clearInterval(timer)
  }, [snapshot.tracking])

  // While the microphone starts or fails, "I can't see you" is not what is wrong (see below).
  const micStatus = useAudio ? microphone.status : null
  useEffect(() => {
    if (snapshot.tracking === 'lost' && micStatus !== 'starting' && micStatus !== 'error') {
      announce('lost')
    }
  }, [snapshot.tracking, micStatus, announce])
  useEffect(() => {
    if (micStatus === 'error') announce('micFailed')
  }, [micStatus, announce])
  useEffect(() => {
    if (wrongSound) announce('wrongSound')
  }, [wrongSound, announce])
  useEffect(() => {
    if (snapshot.lastQuality === 'unknown') announce('unmeasured')
  }, [snapshot.lastQuality, snapshot.repCount, announce])

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), MESSAGE_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [banner])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.toLowerCase() === 'f') end()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [end])

  if (!skill) return <></>

  const quality = snapshot.lastQuality ? QUALITY[snapshot.lastQuality] : undefined
  const phaseKey = phaseLabel(snapshot.phase)
  const lost = snapshot.tracking === 'lost'
  const progressLines = liveLines(snapshot.numbers, skill.progress?.measures ?? [])
  // A skill that tunes a note shows the tuner; one that only listens for sound shows how loud it is.
  const hasPitch = Object.values(skill.metrics).some((metric) => metric.type === 'pitch')

  // A skill that listens is not tracked until the first reading of the sound arrives, so the wait for
  // the microphone, or its failure, must not be told as "I can't see you".
  const micWaiting = useAudio && microphone.status === 'starting'
  const micFailed = useAudio && microphone.status === 'error'

  const interruption = lost && (
    <div
      role="alert"
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[1.875rem] bg-bg/75 px-6 text-center"
    >
      {micWaiting ? (
        <p className="text-3xl font-bold">{t('training.micStarting')}</p>
      ) : micFailed ? (
        <>
          <p className="text-2xl font-bold">
            {t(microphone.errorMessage ?? 'microphone.error.unknown')}
          </p>
          <Button size="lg" variant="light" onClick={microphone.retry}>
            {t('calibration.retry')}
          </Button>
        </>
      ) : (
        <>
          <p className="text-3xl font-bold">{t('training.lost')}</p>
          <Button size="lg" variant="light" onClick={() => go('calibration')}>
            {t('training.recalibrate')}
          </Button>
        </>
      )}
    </div>
  )

  return (
    <section className="force-dark anim-fade flex h-full w-full flex-col gap-4 bg-[#07080b] px-6.5 pt-5 pb-6 text-t1">
      <header className="flex items-center justify-between gap-5">
        <div className="flex items-center gap-3.5">
          <h1 className="text-[0.9375rem] font-semibold">{localize(skill.name)}</h1>
          <span className="rounded-full bg-line/6 px-2.5 py-1 text-xs text-t4">
            {t('screen.training.title')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-9 items-center gap-2 rounded-full bg-line/5 px-3.5 text-[0.8125rem] text-t4">
            <Icon name={useAudio ? 'mic' : 'lock'} className="size-3.5" strokeWidth={1.4} />
            {t(useAudio ? 'training.privacyAudio' : 'training.privacy')}
          </span>
          <span className="text-lg tabular-nums">{clock(elapsedMs)}</span>
        </div>
      </header>

      <p role="status" className="min-h-6 text-center text-lg">
        {wrongSound && wanted
          ? t('training.wrongSound', { instrument: t(`instrument.${wanted}.a`) })
          : adjusting
            ? t('training.personal.hint')
            : personalResult
              ? t(PERSONAL_RESULT[personalResult])
              : skill.goal
                ? localize(skill.goal)
                : ''}
      </p>

      <div className="flex min-h-0 flex-1 gap-5">
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[1.875rem] bg-sunk">
          {useCamera ? (
            <CameraStage
              onFrame={handleFrame}
              withHands={channels.includes('hands') || handControl}
              withObjects={channels.includes('object')}
              mirrored={handControl}
              videoClassName="max-h-[74vh] rounded-[1.875rem]"
            >
              <FinishButton onFinish={end} withHand={handControl} />
            </CameraStage>
          ) : (
            <>
              <FinishButton onFinish={end} withHand={false} />
              <div className="relative flex w-full max-w-xl flex-col items-center gap-6 p-8">
                {tuner ? (
                  <StringTuner
                    targets={targets}
                    index={stringIndex}
                    tuned={tuned}
                    heard={note}
                    cents={targetCents}
                    holdProgress={holdProgress}
                    onPick={pickString}
                  />
                ) : (
                  <RepCounter
                    count={snapshot.repCount}
                    label={unitLabel(skill)}
                    lines={progressLines}
                  />
                )}
                <div role="status" aria-live="assertive" className="relative min-h-24 w-full">
                  {banner && (
                    <CorrectionBand
                      key={banner.id}
                      text={banner.text}
                      channel={banner.channel}
                      praise={banner.praise}
                    />
                  )}
                </div>
                {interruption}
              </div>
            </>
          )}

          {/* These do not depend on the camera: with none, the counter and the messages still show. */}
          {useCamera && (
            <>
              {!targetNote && (
                <div className="absolute top-5 right-5 rounded-3xl bg-bg/85 px-6.5 py-4 text-center">
                  <RepCounter
                    count={snapshot.repCount}
                    label={unitLabel(skill)}
                    lines={progressLines}
                  />
                </div>
              )}
              <div role="status" aria-live="assertive">
                {banner && (
                  <CorrectionBand
                    key={banner.id}
                    text={banner.text}
                    channel={banner.channel}
                    praise={banner.praise}
                  />
                )}
              </div>
              {interruption}
            </>
          )}
        </div>

        <aside className="flex w-95 shrink-0 flex-col gap-3.5">
          {!tuner && (useCamera || phaseKey || quality) && (
            <div className="rounded-3xl border border-line/6 bg-card p-5 text-center">
              <p aria-live="polite" className="min-h-8 text-2xl font-semibold">
                {phaseKey ? t(phaseKey) : ' '}
              </p>
              {quality && (
                <p className="mt-2 text-lg text-t4">
                  {t('training.last')} <span aria-hidden="true">{quality.symbol}</span>{' '}
                  {t(quality.label)}
                </p>
              )}
            </div>
          )}
          {useAudio &&
            (targetNote ? (
              <TargetNote
                target={targetNote}
                heard={note}
                cents={targetCents}
                good={snapshot.numbers.good}
                judged={snapshot.numbers.judged}
              />
            ) : hasPitch && !tuner ? (
              <TunerCard note={note} levelDb={levelDb} />
            ) : (
              <div className="rounded-3xl border border-line/6 bg-card p-5">
                <LevelMeter levelDb={levelDb} />
              </div>
            ))}

          <div className="mt-auto flex flex-col gap-3">
            {isGeneratedSkillId(skill.id) && (
              <Button
                variant="secondary"
                onClick={adjusting ? () => setAdjusting(false) : startAdjusting}
              >
                {adjusting ? t('training.personal.cancel') : t('training.personal.start')}
              </Button>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
