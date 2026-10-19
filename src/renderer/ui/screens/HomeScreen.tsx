import { useEffect, useState } from 'react'
import { t, type MessageKey } from '@renderer/i18n'
import { CoachErrorNotice } from '../CoachErrorNotice'
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
const SUGGESTIONS: ReadonlyArray<{ skillId: string; label: MessageKey; prompt: MessageKey }> = [
  { skillId: 'squat', label: 'home.suggest.squat.label', prompt: 'home.suggest.squat.prompt' },
  {
    skillId: 'guitar_posture',
    label: 'home.suggest.guitar.label',
    prompt: 'home.suggest.guitar.prompt'
  },
  {
    skillId: 'string_tuning',
    label: 'home.suggest.tuning.label',
    prompt: 'home.suggest.tuning.prompt'
  },
  {
    skillId: 'piano_hand',
    label: 'home.suggest.piano.label',
    prompt: 'home.suggest.piano.prompt'
  },
  { skillId: 'pushup', label: 'home.suggest.pushup.label', prompt: 'home.suggest.pushup.prompt' }
]

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
function useResumeStep(): { title: string; skillId: string | null } | null {
  const [step, setStep] = useState<{ title: string; skillId: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.paths
      .getCurrent()
      .then((current) => {
        if (cancelled || !current) return
        const next = current.progress.steps.find((item) => item.state === 'current')
        const found = current.path.steps.find((item) => item.id === next?.stepId)
        if (found)
          setStep({ title: found.title, skillId: found.kind === 'skill' ? found.skillId : null })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return step
}

function QuickLink({
  label,
  target,
  onClick
}: {
  label: string
  target: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center gap-2.5 rounded-2xl px-4.5 text-sm whitespace-nowrap text-mut transition-colors hover:bg-line/5 hover:text-t1"
    >
      {label} <span className="font-semibold text-t1">{target}</span>
      <span aria-hidden="true">→</span>
    </button>
  )
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
      <section className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-10 pt-10 pb-18">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-14rem] left-1/2 h-160 w-250 -translate-x-1/2 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_9%,transparent),transparent)]"
        />
        <CoachAvatar size={104} />
        <h1 className="mt-7.5 mb-3.5 text-center font-display text-[3.625rem] leading-[1.05] font-semibold tracking-tight">
          {t('home.title')}
        </h1>
        <p className="mb-8.5 max-w-135 text-center text-lg leading-normal text-mut text-pretty">
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
        <ul
          aria-label={t('home.suggest.label')}
          className="mt-4.5 flex max-w-190 flex-wrap justify-center gap-2.5"
        >
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion.skillId}>
              <button
                type="button"
                onClick={() => suggest(suggestion)}
                className="h-10 rounded-full border border-line/9 bg-line/3 px-4 text-sm whitespace-nowrap text-t3 transition hover:-translate-y-px hover:border-line/18 hover:bg-line/7"
              >
                {t(suggestion.label)}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-11 flex flex-wrap justify-center gap-3">
          {resume && (
            <QuickLink label={t('home.resume')} target={resume.title} onClick={resumeNow} />
          )}
          <QuickLink
            label={t('home.practiseFree')}
            target={t('nav.library')}
            onClick={() => go('library')}
          />
        </div>
        <p className="absolute right-0 bottom-5.5 left-0 flex items-center justify-center gap-2 text-[0.8rem] text-mut2">
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
