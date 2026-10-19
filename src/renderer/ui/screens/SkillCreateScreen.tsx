import { useEffect, useState } from 'react'
import { t } from '@renderer/i18n'
import { voice } from '@renderer/voice'
import { MAX_SKILL_DESCRIPTION } from '@shared/skillGeneration'
import { ChatComposer } from '../chat/ChatComposer'
import { CoachErrorNotice } from '../CoachErrorNotice'
import { channelList, REASON_TEXT } from '../feasibilityText'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { CoachAvatar } from '../kit/CoachAvatar'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'
import { useSettings } from '../settingsStore'
import { openSettings } from '../settingsTabStore'
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
      <p className="font-semibold">{t('skill.refusal.outOfScope')}</p>
      <ul className="flex list-inside list-disc flex-col gap-1 text-t4">
        {refusal.reasons.map((reason) => (
          <li key={reason}>{t(REASON_TEXT[reason])}</li>
        ))}
      </ul>
      {refusal.measurable.length > 0 && (
        <p className="text-mut">
          {t('path.outcome.measurable', { channels: channelList(refusal.measurable) })}
        </p>
      )}
    </>
  )
}

function List({ title, items }: { title: string; items: string[] }): React.JSX.Element {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-1.5 flex list-inside list-disc flex-col gap-1 text-[0.9rem] text-t4">
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
  const [description, setDescription] = useState(() => useSkillDraft.getState().suggestion)

  // A draft from before is still waiting for an answer.
  useEffect(() => {
    void loadDraft(window.api)
    // The suggestion has been used: it must not come back the next time the screen opens.
    useSkillDraft.setState({ suggestion: '' })
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
    <section className="mx-auto flex h-full w-full max-w-190 flex-col gap-5 self-start overflow-y-auto px-8 pt-8 pb-12">
      <header className="flex flex-wrap items-center gap-4">
        <CoachAvatar size={44} />
        <h1 className="font-display text-[1.875rem] leading-tight font-semibold tracking-tight">
          {t('screen.skillNew.title')}
        </h1>
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            resetSkillDraft()
            go('library')
          }}
        >
          {t('skill.new.back')}
        </Button>
      </header>

      {!aiEnabled && preview === null ? (
        <Card className="flex flex-col items-start gap-4 p-6">
          <p className="text-t4">{t('skill.new.off')}</p>
          <Button onClick={() => openSettings('ai')}>{t('coach.openSettings')}</Button>
        </Card>
      ) : (
        <>
          {preview === null && <p className="text-lg text-mut">{t('skill.new.intro')}</p>}
          {pending && (
            <p role="status" className="flex items-center gap-3 text-sm text-mut">
              <CoachAvatar thinking size={30} />
              {t('skill.new.thinking')}
            </p>
          )}
          {error && (
            <CoachErrorNotice
              error={error}
              onRetry={() => useSkillDraft.setState({ error: null })}
            />
          )}

          {refusal && (
            <Card role="status" className="flex flex-col items-start gap-2.5 p-6">
              <Refusal refusal={refusal} />
            </Card>
          )}

          {preview && (
            <Card raised className="flex flex-col gap-4 p-6.5">
              <h2 className="text-xl font-semibold">{t('skill.preview.title')}</h2>
              <p className="font-display text-2xl font-semibold tracking-tight">{preview.name}</p>
              <p
                role="note"
                className="rounded-2xl border border-dashed border-warn p-4 text-sm leading-normal"
              >
                {t('skill.preview.experimental')}
              </p>
              {lacksVoice && (
                <p role="note" className="text-sm text-warn-text">
                  {t('skill.preview.noVoice')}
                </p>
              )}
              <div>
                <h3 className="text-sm font-semibold">{t('skill.preview.camera')}</h3>
                <p className="mt-1 text-[0.9rem] text-t4">{preview.camera}</p>
              </div>
              <List title={t('skill.preview.metrics')} items={preview.metrics} />
              <List title={t('skill.preview.phases')} items={preview.phases} />
              <div>
                <h3 className="text-sm font-semibold">{t('skill.preview.repetition')}</h3>
                <p className="mt-1 text-[0.9rem] text-t4">{preview.repetition}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold">{t('skill.preview.rules')}</h3>
                <ul className="mt-1.5 flex list-inside list-disc flex-col gap-1 text-[0.9rem] text-t4">
                  {preview.rules.map((rule) => (
                    <li key={rule.message}>
                      {rule.message} ({rule.severity})
                    </li>
                  ))}
                </ul>
              </div>
              {actionFailed && (
                <p role="alert" className="text-sm text-bad-text">
                  {t('skill.preview.failed')}
                </p>
              )}
              <div className="flex flex-wrap gap-2.5">
                <Button size="lg" onClick={tryIt}>
                  {t('skill.preview.try')}
                </Button>
                <Button size="lg" variant="secondary" onClick={() => void discardDraft(window.api)}>
                  {t('skill.preview.discard')}
                </Button>
              </div>
            </Card>
          )}

          {preview === null && aiEnabled && (
            <ChatComposer
              variant="dock"
              label={t('skill.new.input')}
              placeholder={t('skill.new.placeholder')}
              maxLength={MAX_SKILL_DESCRIPTION}
              value={description}
              onChange={setDescription}
              onSend={send}
              disabled={pending}
            />
          )}
        </>
      )}
    </section>
  )
}
