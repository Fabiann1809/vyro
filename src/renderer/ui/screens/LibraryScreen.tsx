import { localize, t } from '@renderer/i18n'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'
import { useSkills } from '../skillsStore'

export function LibraryScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const selectSkill = useSession((state) => state.selectSkill)
  const skills = useSkills((state) => state.skills)

  const start = (skillId: string): void => {
    selectSkill(skillId)
    go('calibration')
  }

  return (
    <section className="flex w-full max-w-4xl flex-col gap-8 self-start p-8">
      <div>
        <h1 className="text-3xl font-semibold">{t('screen.library.title')}</h1>
        <p className="mt-1 text-mut">{t('library.choose')}</p>
      </div>

      <ul className="grid grid-cols-3 gap-4">
        {skills.map((skill) => (
          <li key={skill.id}>
            <button
              type="button"
              onClick={() => start(skill.id)}
              className="w-full rounded-lg border border-line/14 p-6 text-left text-xl font-medium hover:border-brand"
            >
              {localize(skill.name)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
