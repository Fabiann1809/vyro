import { useState } from 'react'
import { t, type MessageKey } from '@renderer/i18n'
import type { Channel, OutOfScopeReason } from '@shared/feasibility'
import { CoachErrorNotice } from './CoachErrorNotice'
import { ConversationLog, MessageBox } from './Conversation'
import { useNavigation } from './navigation'
import { PathStepCard } from './PathStepCard'
import {
  resetPlanner,
  retryPlanner,
  sendToPlanner,
  usePathPlan,
  type PlanOutcome
} from './pathPlanStore'
import { plannerSkills } from './plannerSkills'
import { useSettings } from './settingsStore'

const REASON_TEXT: Record<OutOfScopeReason, MessageKey> = {
  'invisible-outcome': 'path.reason.invisible-outcome',
  'too-fine-detail': 'path.reason.too-fine-detail',
  'out-of-frame': 'path.reason.out-of-frame',
  'needs-touch': 'path.reason.needs-touch',
  'physical-risk': 'path.reason.physical-risk',
  'no-signal': 'path.reason.no-signal',
  'unsupported-object': 'path.reason.unsupported-object'
}

const CHANNEL_TEXT: Record<Channel, MessageKey> = {
  body: 'path.channel.body',
  hands: 'path.channel.hands',
  audio: 'path.channel.audio',
  object: 'path.channel.object'
}

const channelList = (channels: readonly Channel[]): string =>
  channels.map((channel) => t(CHANNEL_TEXT[channel])).join(', ')

// Why there is no path, in words the person can use to ask for something else.
function Reasons({
  outcome
}: {
  outcome: Exclude<PlanOutcome, { kind: 'path' }>
}): React.JSX.Element {
  if (outcome.kind === 'out-of-scope') {
    return (
      <>
        <h2 className="text-xl font-semibold">{t('path.outcome.outOfScope.title')}</h2>
        <ul className="list-inside list-disc">
          {outcome.reasons.map((reason) => (
            <li key={reason}>{t(REASON_TEXT[reason])}</li>
          ))}
        </ul>
        {outcome.measurable.length > 0 && (
          <p>{t('path.outcome.measurable', { channels: channelList(outcome.measurable) })}</p>
        )}
      </>
    )
  }
  if (outcome.kind === 'planned') {
    return (
      <>
        <h2 className="text-xl font-semibold">{t('path.outcome.planned.title')}</h2>
        <p>
          {t('path.outcome.planned.body', {
            channels: channelList(outcome.pending.map((item) => item.channel))
          })}
        </p>
      </>
    )
  }
  return (
    <>
      <h2 className="text-xl font-semibold">{t('path.outcome.noSkill.title')}</h2>
      <p>{t('path.outcome.noSkill.body')}</p>
    </>
  )
}

// Where a path is made: the person says what they want to learn, the coach may ask a few things,
// and either proposes a path to keep or explains why it cannot.
export function PathPlanner({
  onSaved,
  onCancel
}: {
  onSaved: () => void
  // Only when there is a path to go back to.
  onCancel?: () => void
}): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const { aiEnabled, language } = useSettings()
  const { turns, pending, error, outcome } = usePathPlan()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const send = (): void => {
    const text = draft
    if (text.trim() === '' || pending || outcome) return
    setDraft('')
    void sendToPlanner(window.api, text, language, plannerSkills())
  }

  const save = (): void => {
    if (outcome?.kind !== 'path') return
    setSaving(true)
    window.api.paths
      .save(outcome.path)
      .then(() => {
        resetPlanner()
        setSaveFailed(false)
        onSaved()
      })
      .catch(() => setSaveFailed(true))
      .finally(() => setSaving(false))
  }

  return (
    <section className="flex h-full w-full max-w-3xl flex-col gap-3 self-start p-6">
      <header className="flex flex-wrap items-baseline gap-4">
        <h1 className="text-3xl font-semibold">{t('screen.path.title')}</h1>
        {onCancel && (
          <button
            type="button"
            onClick={() => {
              resetPlanner()
              onCancel()
            }}
            className="ml-auto rounded-md bg-slate-200 px-3 py-1.5 text-sm dark:bg-slate-800"
          >
            {t('path.cancel')}
          </button>
        )}
      </header>

      {!aiEnabled ? (
        <div className="flex flex-col items-start gap-3">
          <h2 className="text-xl font-semibold">{t('coach.off.title')}</h2>
          <p>{t('path.planner.off')}</p>
          <button
            type="button"
            onClick={() => go('settings')}
            className="rounded-md bg-emerald-700 px-4 py-2 text-white"
          >
            {t('coach.openSettings')}
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold">{t('path.planner.title')}</h2>
          {onCancel && <p className="text-sm">{t('path.new.note')}</p>}

          <ConversationLog
            turns={turns}
            pending={pending}
            pendingText={t('path.planner.thinking')}
            introText={t('path.planner.intro')}
            label={t('path.planner.log')}
          />

          {error && (
            <CoachErrorNotice
              error={error}
              onRetry={() => void retryPlanner(window.api, language, plannerSkills())}
              retryDisabled={pending}
            />
          )}

          {outcome?.kind === 'path' && (
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">{t('path.preview.title')}</h2>
              <p className="text-lg">{outcome.path.goal}</p>
              <ol className="flex flex-col gap-3">
                {outcome.path.steps.map((step, index) => (
                  <PathStepCard key={index} step={step} number={index + 1} />
                ))}
              </ol>
              {saveFailed && <p role="alert">{t('path.saveFailed')}</p>}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
                >
                  {t('path.save')}
                </button>
                <button
                  type="button"
                  onClick={resetPlanner}
                  disabled={saving}
                  className="rounded-md bg-slate-200 px-4 py-2 disabled:opacity-50 dark:bg-slate-800"
                >
                  {t('path.discard')}
                </button>
              </div>
            </div>
          )}

          {outcome && outcome.kind !== 'path' && (
            <div role="status" className="flex flex-col items-start gap-2">
              <Reasons outcome={outcome} />
              <button
                type="button"
                onClick={resetPlanner}
                className="rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
              >
                {t('path.restart')}
              </button>
            </div>
          )}

          {!outcome && (
            <MessageBox
              label={t('path.planner.input')}
              value={draft}
              onChange={setDraft}
              onSend={send}
              disabled={pending}
            />
          )}
        </>
      )}
    </section>
  )
}
