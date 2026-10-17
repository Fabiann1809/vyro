import { useEffect, useState } from 'react'
import { t } from '@renderer/i18n'
import { voice } from '@renderer/voice'
import { MAX_SKILL_DESCRIPTION } from '@shared/skillGeneration'
import { CoachErrorNotice } from '../CoachErrorNotice'
import { MessageBox } from '../Conversation'
import { channelList, REASON_TEXT } from '../feasibilityText'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'
import { useSettings } from '../settingsStore'
import {
  approveDraft,
  discardDraft,
  loadDraft,
  requestSkill,
  resetSkillDraft,
  useSkillDraft,
  type SkillRefusal
} from '../skillDraftStore'
import { describeSkill } from '../skillPreview'
import { useSkills } from '../skillsStore'

function Refusal({ refusal }: { refusal: SkillRefusal }): React.JSX.Element {
  if (refusal.kind === 'planned') {
    return (
      <p>
        {t('skill.refusal.planned', {
          channels: channelList(refusal.pending.map((item) => item.channel))
        })}
      </p>
    )
  }
  return (
    <>
      <p>{t('skill.refusal.outOfScope')}</p>
      <ul className="list-inside list-disc">
        {refusal.reasons.map((reason) => (
          <li key={reason}>{t(REASON_TEXT[reason])}</li>
        ))}
      </ul>
      {refusal.measurable.length > 0 && (
        <p>{t('path.outcome.measurable', { channels: channelList(refusal.measurable) })}</p>
      )}
    </>
  )
}

function List({ title, items }: { title: string; items: string[] }): React.JSX.Element {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="list-inside list-disc">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

// Where the AI makes a skill. Nothing it makes can be practised until the person has read what it
// will measure and correct, and approved it.
export function SkillCreateScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const selectSkill = useSession((state) => state.selectSkill)
  const { aiEnabled, language } = useSettings()
  const skills = useSkills((state) => state.skills)
  const { pending, error, refusal, draft, actionFailed } = useSkillDraft()
  const [description, setDescription] = useState('')

  // A draft from before is still waiting for an answer.
  useEffect(() => {
    void loadDraft(window.api)
  }, [])

  const send = (): void => {
    void requestSkill(
      window.api,
      description,
      language,
      skills.map((skill) => skill.id)
    )
    setDescription('')
  }

  const tryIt = (): void => {
    void approveDraft(window.api).then((id) => {
      if (!id) return
      selectSkill(id)
      go('calibration')
    })
  }

  const preview = draft ? describeSkill(draft) : null
  // A new text has no recorded clip to fall back on, so without a voice it is silent.
  const lacksVoice = !voice.hasSystemVoice(language)

  return (
    <section className="flex w-full max-w-3xl flex-col gap-4 self-start p-6">
      <header className="flex flex-wrap items-baseline gap-4">
        <h1 className="text-3xl font-semibold">{t('screen.skillNew.title')}</h1>
        <button
          type="button"
          onClick={() => {
            resetSkillDraft()
            go('home')
          }}
          className="ml-auto rounded-md bg-slate-200 px-3 py-1.5 text-sm dark:bg-slate-800"
        >
          {t('skill.new.back')}
        </button>
      </header>

      {!aiEnabled && preview === null ? (
        <div className="flex flex-col items-start gap-3">
          <p>{t('skill.new.off')}</p>
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
          {preview === null && <p>{t('skill.new.intro')}</p>}
          {pending && <p role="status">{t('skill.new.thinking')}</p>}
          {error && (
            <CoachErrorNotice
              error={error}
              onRetry={() => useSkillDraft.setState({ error: null })}
            />
          )}

          {refusal && (
            <div role="status" className="flex flex-col items-start gap-2">
              <Refusal refusal={refusal} />
            </div>
          )}

          {preview && (
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">{t('skill.preview.title')}</h2>
              <p className="text-lg">{preview.name}</p>
              <p role="note" className="rounded-md border border-amber-600 p-3">
                {t('skill.preview.experimental')}
              </p>
              {lacksVoice && <p role="note">{t('skill.preview.noVoice')}</p>}
              <div>
                <h3 className="font-semibold">{t('skill.preview.camera')}</h3>
                <p>{preview.camera}</p>
              </div>
              <List title={t('skill.preview.metrics')} items={preview.metrics} />
              <List title={t('skill.preview.phases')} items={preview.phases} />
              <div>
                <h3 className="font-semibold">{t('skill.preview.repetition')}</h3>
                <p>{preview.repetition}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t('skill.preview.rules')}</h3>
                <ul className="list-inside list-disc">
                  {preview.rules.map((rule) => (
                    <li key={rule.message}>
                      {rule.message} ({rule.severity})
                    </li>
                  ))}
                </ul>
              </div>
              {actionFailed && <p role="alert">{t('skill.preview.failed')}</p>}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={tryIt}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-white"
                >
                  {t('skill.preview.try')}
                </button>
                <button
                  type="button"
                  onClick={() => void discardDraft(window.api)}
                  className="rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
                >
                  {t('skill.preview.discard')}
                </button>
              </div>
            </div>
          )}

          {preview === null && aiEnabled && (
            <MessageBox
              label={t('skill.new.input')}
              value={description}
              onChange={setDescription}
              onSend={send}
              disabled={pending}
              maxLength={MAX_SKILL_DESCRIPTION}
            />
          )}
        </>
      )}
    </section>
  )
}
