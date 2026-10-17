import { useState } from 'react'
import { localize, t } from '@renderer/i18n'
import { isGeneratedSkillId } from '@shared/skill/generatedSafety'
import { deleteGeneratedSkill } from './generatedSkills'
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
    <>
      {generated.length === 0 && <p>{t('settings.skills.empty')}</p>}
      <ul className="flex flex-col gap-3">
        {generated.map((skill) => {
          const name = localize(skill.name)
          return (
            <li key={skill.id} className="flex flex-col gap-2">
              {asking === skill.id ? (
                <div
                  role="alertdialog"
                  aria-label={t('settings.skills.question', { name })}
                  className="flex flex-col gap-3"
                >
                  <p className="font-semibold">{t('settings.skills.question', { name })}</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => remove(skill.id)}
                      className="rounded-md bg-red-700 px-4 py-2 text-white"
                    >
                      {t('settings.skills.confirm')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAsking(null)}
                      className="rounded-md bg-slate-200 px-4 py-2 dark:bg-slate-800"
                    >
                      {t('settings.skills.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null)
                      setAsking(skill.id)
                    }}
                    className="rounded-md bg-red-700 px-4 py-2 text-white"
                  >
                    {t('settings.skills.delete', { name })}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {result === 'done' && <p role="status">{t('settings.skills.done')}</p>}
      {result === 'failed' && <p role="alert">{t('settings.skills.failed')}</p>}
    </>
  )
}
