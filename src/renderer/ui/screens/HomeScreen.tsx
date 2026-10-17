import { localize, t } from '@renderer/i18n'
import { SessionList } from '../SessionList'
import { useNavigation } from '../navigation'
import { useSessionList } from '../useSessionList'
import { useSession } from '../sessionStore'
import { useSkills } from '../skillsStore'

const RECENT_SESSIONS = 3

export function HomeScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const selectSkill = useSession((state) => state.selectSkill)
  const skills = useSkills((state) => state.skills)
  const { status, sessions } = useSessionList({ limit: RECENT_SESSIONS })

  const start = (skillId: string): void => {
    selectSkill(skillId)
    go('calibration')
  }

  return (
    <section className="flex w-full max-w-4xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-semibold">{t('screen.home.title')}</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">{t('home.choose')}</p>
      </div>

      <ul className="grid grid-cols-3 gap-4">
        {skills.map((skill) => (
          <li key={skill.id}>
            <button
              type="button"
              onClick={() => start(skill.id)}
              className="w-full rounded-lg border border-slate-300 p-6 text-left text-xl font-medium hover:border-emerald-500 dark:border-slate-700"
            >
              {localize(skill.name)}
            </button>
          </li>
        ))}
      </ul>

      <div>
        <h2 className="text-xl font-semibold">{t('home.recent.title')}</h2>
        {status === 'ready' && sessions.length === 0 && (
          <p className="mt-1 text-slate-600 dark:text-slate-400">{t('home.recent.empty')}</p>
        )}
        {sessions.length > 0 && <SessionList sessions={sessions} />}
      </div>
    </section>
  )
}
