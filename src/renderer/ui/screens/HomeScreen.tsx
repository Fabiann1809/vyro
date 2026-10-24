import { useEffect, useState } from 'react'
import { t, type MessageKey } from '@renderer/i18n'
import type { SessionRow } from '@shared/sessions'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { CoachErrorNotice } from '../CoachErrorNotice'
import { ChannelOrb } from '../kit/ChannelOrb'
import { ChannelOrbit } from '../home/ChannelOrbit'
import { Shortcuts } from '../home/Shortcuts'
import { streakLength, weekDays } from '../dashboardData'
import { useSkills } from '../skillsStore'
import { Thread, type ThreadActions } from '../chat/Thread'
import { ChatComposer } from '../chat/ChatComposer'
import { useCoach } from '../coachStore'
import {
  adjustProposal,
  buildThread,
  currentError,
  retryFromHome,
  saveProposedPath,
  sendFromHome,
  startOver,
  useHomeChat
} from '../homeChatStore'
import { Button } from '../kit/Button'
import { Icon } from '../kit/Icon'
import { CoachAvatar } from '../kit/CoachAvatar'
import { startWithExpand } from '../expandTransition'
import { focusComposer } from '../focusComposer'
import { useNavigation } from '../navigation'
import { usePathPlan } from '../pathPlanStore'
import { suggestSkill } from '../skillDraftStore'
import { openSettings } from '../settingsTabStore'
import { plannerSkills } from '../plannerSkills'
import { useSession } from '../sessionStore'
import { useSettings } from '../settingsStore'
import { useReducedMotion } from '../useReducedMotion'

// What the empty screen offers to start with. With the coach on, a suggestion fills the box; with it
// off, it opens the skill itself, so that the screen is never a dead end.

const SUGGESTIONS: ReadonlyArray<{
  skillId: string
  label: MessageKey
  prompt: MessageKey
  channel: SkillChannel
}> = [
  {
    skillId: 'squat',
    label: 'home.suggest.squat.label',
    prompt: 'home.suggest.squat.prompt',
    channel: 'body'
  },
  {
    skillId: 'guitar_posture',
    label: 'home.suggest.guitar.label',
    prompt: 'home.suggest.guitar.prompt',
    channel: 'object'
  },
  {
    skillId: 'string_tuning',
    label: 'home.suggest.tuning.label',
    prompt: 'home.suggest.tuning.prompt',
    channel: 'audio'
  },
  {
    skillId: 'piano_hand',
    label: 'home.suggest.piano.label',
    prompt: 'home.suggest.piano.prompt',
    channel: 'hands'
  },
  {
    skillId: 'pushup',
    label: 'home.suggest.pushup.label',
    prompt: 'home.suggest.pushup.prompt',
    channel: 'body'
  }
]

const hourGreeting = (hour: number): MessageKey =>
  hour < 12
    ? 'home.greeting.morning'
    : hour < 20
      ? 'home.greeting.afternoon'
      : 'home.greeting.night'

const PLACEHOLDERS: readonly MessageKey[] = [
  'home.placeholder.guitar',
  'home.placeholder.squat',
  'home.placeholder.tuning'
]
const PLACEHOLDER_MS = 3200

// The text that rotates in the empty box, to show what can be asked. It stays still when the person
// asked for less movement.
function usePlaceholder(): string {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (reduceMotion) return
    const timer = setInterval(() => setIndex((value) => value + 1), PLACEHOLDER_MS)
    return () => clearInterval(timer)
  }, [reduceMotion])
  return t(PLACEHOLDERS[index % PLACEHOLDERS.length]!)
}

// The step to go back to: the one that is next in the path being followed, if there is a path.
interface ResumeStep {
  title: string
  skillId: string | null
  // The number of the step (from 1) and how many the path has.
  step: number
  total: number
}

function useResumeStep(): ResumeStep | null {
  const [step, setStep] = useState<ResumeStep | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.paths
      .getCurrent()
      .then((current) => {
        if (cancelled || !current) return
        const next = current.progress.steps.find((item) => item.state === 'current')
        const found = current.path.steps.find((item) => item.id === next?.stepId)
        if (found) {
          setStep({
            title: found.title,
            skillId: found.kind === 'skill' ? found.skillId : null,
            step: current.path.steps.indexOf(found) + 1,
            total: current.path.steps.length
          })
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return step
}

// The sessions saved so far, for the streak of the shortcuts; none while they load or if they fail.
function useSessionRows(): SessionRow[] {
  const [rows, setRows] = useState<SessionRow[]>([])
  useEffect(() => {
    let cancelled = false
    window.api.sessions
      .list()
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return rows
}

export function HomeScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const selectSkill = useSession((state) => state.selectSkill)
  const { aiEnabled, language } = useSettings()
  const planner = usePathPlan()
  const coach = useCoach()
  const home = useHomeChat()
  const [draft, setDraft] = useState('')
  const placeholder = usePlaceholder()
  const resume = useResumeStep()
  const sessionRows = useSessionRows()
  const skillCount = useSkills((state) => state.skills.length)
  const [now] = useState(() => Date.now())

  const thread = buildThread({
    plannerTurns: planner.turns,
    outcome: planner.outcome,
    routeStatus: home.routeStatus,
    coachTurns: coach.turns,
    offlineTexts: home.offlineTexts
  })
  const pending = planner.pending || coach.pending
  const error = currentError(home.mode, planner.error, coach.error)
  const empty = thread.length === 0 && !pending

  const send = (): void => {
    const text = draft
    if (text.trim() === '' || pending) return
    setDraft('')
    void sendFromHome(window.api, text, language, plannerSkills(), aiEnabled)
  }

  const practise = (skillId: string): void => {
    selectSkill(skillId)
    go('calibration')
  }

  const suggest = (suggestion: (typeof SUGGESTIONS)[number]): void => {
    if (aiEnabled) {
      setDraft(t(suggestion.prompt))
      focusComposer()
    } else {
      practise(suggestion.skillId)
    }
  }

  const resumeNow = (): void => {
    if (resume?.skillId) practise(resume.skillId)
    else go('path')
  }

  // Keeps the path and goes where it begins: the first skill to practise, or the path itself when the
  // first step is not a skill.
  const keepAndGo = async (toFirstStep: boolean): Promise<void> => {
    if (!(await saveProposedPath(window.api))) return
    if (!toFirstStep) return go('path')
    const current = await window.api.paths.getCurrent().catch(() => null)
    const next = current?.progress.steps.find((item) => item.state === 'current')
    const step = current?.path.steps.find((item) => item.id === next?.stepId)
    if (step?.kind === 'skill') {
      const skillToPractise = step.skillId
      // The card of the path grows until it is the calibration.
      startWithExpand(document.querySelector('[data-card="route"]'), () =>
        practise(skillToPractise)
      )
    } else {
      go('path')
    }
  }

  const actions: ThreadActions = {
    onStartRoute: () => void keepAndGo(true),
    onViewRoute: () => void keepAndGo(false),
    onAdjustRoute: () => {
      adjustProposal()
      focusComposer()
    },
    onRestart: () => {
      startOver()
      focusComposer()
    },
    onCreateSkill: () => {
      const goal = [...planner.turns].reverse().find((turn) => turn.role === 'user')
      suggestSkill(goal?.text ?? '')
      go('skillNew')
    },
    onEnableAi: () => openSettings('ai'),
    onOpenLibrary: () => go('library')
  }

  if (empty) {
    return (
      <section className="flex h-full w-full flex-col gap-5 overflow-x-hidden overflow-y-auto px-8.5 pt-6.5 pb-4.5">
        <div className="grid flex-1 grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] items-center gap-7">
          <div className="flex flex-col gap-5.5">
            <p className="flex h-9 items-center gap-2.5 self-start rounded-full border border-line/10 bg-(--glass) pr-4 pl-3 text-[0.84rem] text-t2">
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${aiEnabled ? 'bg-good shadow-[0_0_10px_var(--good)]' : 'bg-mut3'}`}
              />
              {t(hourGreeting(new Date(now).getHours()))} ·{' '}
              {t(aiEnabled ? 'home.status.on' : 'home.status.off')}
            </p>
            <h1 className="font-display text-[4.25rem] leading-[0.98] font-bold tracking-[-0.035em]">
              {t('home.title.first')}
              <br />
              <span className="text-grad">{t('home.title.last')}</span>
            </h1>
            <p className="max-w-125 text-lg leading-normal text-mut text-pretty">
              {t('home.lead')}
            </p>
            <ChatComposer
              variant="hero"
              value={draft}
              onChange={setDraft}
              onSend={send}
              disabled={pending}
              placeholder={placeholder}
            />
            <ul aria-label={t('home.suggest.label')} className="flex flex-wrap gap-2.5">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion.skillId}>
                  <button
                    type="button"
                    onClick={() => suggest(suggestion)}
                    className="flex h-10.5 items-center gap-2 rounded-full border border-line/10 bg-line/4 pr-4 pl-2 text-sm whitespace-nowrap text-t2 transition duration-200 hover:-translate-y-0.5 hover:border-line/22 hover:bg-line/9"
                  >
                    <ChannelOrb channel={suggestion.channel} size="size-7" />
                    {t(suggestion.label)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <ChannelOrbit />
        </div>
        <Shortcuts
          resume={resume}
          streak={streakLength(sessionRows, now)}
          week={weekDays(sessionRows, now)}
          skillCount={skillCount}
          onResume={resumeNow}
          onStreak={() => go('dashboard')}
          onLibrary={() => go('library')}
        />
        <p className="flex items-center justify-center gap-2 text-[0.78rem] text-mut2">
          <Icon name="lock" className="size-3.5" />
          {t('home.privacy')}
        </p>
      </section>
    )
  }

  return (
    <section className="relative flex h-full w-full flex-col">
      <header className="flex items-center justify-between border-b border-line/5 px-8 py-4.5">
        <div className="flex items-center gap-3">
          <CoachAvatar />
          <div>
            <p className="text-[0.9375rem] font-semibold">{t('home.coachName')}</p>
            <p className="text-xs whitespace-nowrap text-mut">
              {t(aiEnabled ? 'nav.ai.on' : 'nav.ai.off')}
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={startOver} disabled={pending}>
          {t('coach.new')}
        </Button>
      </header>

      <Thread items={thread} pending={pending} actions={actions} />

      <div className="px-10 pt-3.5 pb-4.5">
        <div className="mx-auto flex max-w-195 flex-col gap-3">
          {error && (
            <CoachErrorNotice
              error={error}
              onRetry={() => void retryFromHome(window.api, language, plannerSkills())}
              retryDisabled={pending}
            />
          )}
          <ChatComposer
            variant="dock"
            value={draft}
            onChange={setDraft}
            onSend={send}
            disabled={pending}
            placeholder={t('home.placeholder.reply')}
          />
          <p className="text-center text-xs text-mut2">{t('home.privacy.chat')}</p>
        </div>
      </div>
    </section>
  )
}
