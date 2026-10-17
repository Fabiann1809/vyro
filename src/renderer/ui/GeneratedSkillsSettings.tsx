import { useState } from 'react'
import { localize, t } from '@renderer/i18n'
import { isGeneratedSkillId } from '@shared/skill/generatedSafety'
import { deleteGeneratedSkill } from './generatedSkills'
import { Button } from './kit/Button'
import { Card } from './kit/Card'
import { useSkills } from './skillsStore'

// The skills the AI made, each with a way to delete it. Deleting asks first.
export function GeneratedSkillsSettings(): React.JSX.Element {
  const generated = useSkills((state) => state.skills).filter((skill) =>
    isGeneratedSkillId(skill.id)
  )
  const [asking, setAsking] = useState<string | null>(null)
  const [result, setResult] = useState<'done' | 'failed' | null>(null)

  const remove = (id: string): void => {
    setAsking(null)
    void deleteGeneratedSkill(window.api, id).then((deleted) =>
      setResult(deleted ? 'done' : 'failed')
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {generated.length === 0 && (
        <p className="rounded-3xl border border-dashed border-line/10 p-8 text-center text-mut">
          {t('settings.skills.empty')}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {generated.map((skill) => {
          const name = localize(skill.name)
          return (
            <li key={skill.id}>
              {asking === skill.id ? (
                <Card
                  role="alertdialog"
                  aria-label={t('settings.skills.question', { name })}
                  className="flex flex-col gap-3 border-bad/40 p-5"
                >
                  <p className="font-semibold">{t('settings.skills.question', { name })}</p>
                  <div className="flex gap-2.5">
                    <Button variant="danger" onClick={() => remove(skill.id)}>
                      {t('settings.skills.confirm')}
                    </Button>
                    <Button variant="secondary" onClick={() => setAsking(null)}>
                      {t('settings.skills.cancel')}
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className="flex items-center justify-between gap-3 px-5 py-4">
                  <span className="flex items-center gap-2.5 font-medium">
                    {name}
                    <span className="rounded-full border border-dashed border-warn px-2 py-0.5 text-[0.7rem] font-semibold text-warn-text">
                      {t('library.badge.experimental')}
                    </span>
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setResult(null)
                      setAsking(skill.id)
                    }}
                  >
                    {t('settings.skills.delete', { name })}
                  </Button>
                </Card>
              )}
            </li>
          )
        })}
      </ul>
      {result === 'done' && (
        <p role="status" className="text-sm text-t4">
          {t('settings.skills.done')}
        </p>
      )}
      {result === 'failed' && (
        <p role="alert" className="text-sm text-bad-text">
          {t('settings.skills.failed')}
        </p>
      )}
    </div>
  )
}
