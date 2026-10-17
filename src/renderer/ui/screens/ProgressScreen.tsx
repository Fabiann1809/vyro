import { useState } from 'react'
import { localize, t } from '@renderer/i18n'
import { ProgressCharts } from '../ProgressCharts'
import { SessionList } from '../SessionList'
import { useNavigation } from '../navigation'
import { useSessionList } from '../useSessionList'
import { useSkills } from '../skillsStore'

export function ProgressScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const skills = useSkills((state) => state.skills)
  // undefined = every skill
  const [skillId, setSkillId] = useState<string | undefined>(undefined)
  const { status, sessions } = useSessionList({ skillId })

  return (
    <section className="flex w-full max-w-4xl flex-col gap-6 self-start p-8">
      <h1 className="text-3xl font-semibold">{t('screen.progress.title')}</h1>

      <label className="flex w-fit items-center gap-2">
        {t('progress.filter')}
        <select
          value={skillId ?? ''}
          onChange={(event) => setSkillId(event.target.value || undefined)}
          className="rounded bg-slate-200 px-3 py-2 dark:bg-slate-800"
        >
          <option value="">{t('progress.allSkills')}</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {localize(skill.name)}
            </option>
          ))}
        </select>
      </label>

      <div>
        <h2 className="text-xl font-semibold">{t('progress.evolution')}</h2>
        {skillId === undefined ? (
          <p className="mt-1 text-slate-600 dark:text-slate-400">{t('progress.pickSkill')}</p>
        ) : (
          status === 'ready' && <ProgressCharts sessions={sessions} />
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold">{t('progress.history')}</h2>
        {status === 'error' && <p role="alert">{t('progress.error')}</p>}
        {status === 'ready' && sessions.length === 0 && (
          <div className="mt-2 flex flex-col items-start gap-3">
            <p className="text-slate-600 dark:text-slate-400">{t('progress.empty')}</p>
            <button
              type="button"
              onClick={() => go('home')}
              className="rounded-md bg-emerald-700 px-4 py-2 text-white"
            >
              {t('progress.start')}
            </button>
          </div>
        )}
        {sessions.length > 0 && <SessionList sessions={sessions} />}
      </div>
    </section>
  )
}
