import { useState } from 'react'
import { t } from '@renderer/i18n'
import { ActiveRouteCard } from '../dashboard/ActiveRouteCard'
import { ChannelCards } from '../dashboard/ChannelCards'
import { ConsistencyCard } from '../dashboard/ConsistencyCard'
import { ErrorsCard } from '../dashboard/ErrorsCard'
import { HistoryList } from '../dashboard/HistoryList'
import { MeasuresCards } from '../dashboard/MeasuresCard'
import { QualityCard } from '../dashboard/QualityCard'
import { ScoreCard } from '../dashboard/ScoreCard'
import { useDashboardData } from '../dashboard/useDashboardData'
import {
  channelSeries,
  daysAgo,
  errorRows,
  scorePoints,
  scoreStory,
  streakLength
} from '../dashboardData'
import { measureSeries } from '../dashboardUnits'
import { startWithExpand } from '../expandTransition'
import { Button } from '../kit/Button'
import { focusComposer } from '../focusComposer'
import { useNavigation } from '../navigation'
import { useSession } from '../sessionStore'
import { skillDisplayName } from '../skillName'
import { useSkills } from '../skillsStore'

// The skills that have sessions, the one used last first: the choices of the filter.
function usedSkills(sessions: ReadonlyArray<{ skillId: string }>): string[] {
  return [...new Set(sessions.map((session) => session.skillId))]
}

export function DashboardScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const selectSkill = useSession((state) => state.selectSkill)
  const skills = useSkills((state) => state.skills)
  const [now] = useState(() => Date.now())
  const data = useDashboardData(now)
  // null = every skill
  const [skillId, setSkillId] = useState<string | null>(null)

  if (data.status === 'loading') {
    return (
      <p role="status" className="text-mut">
        {t('path.loading')}
      </p>
    )
  }
  if (data.status === 'error') return <p role="alert">{t('progress.error')}</p>

  const choices = usedSkills(data.sessions)
  const sessions = data.sessions.filter(
    (session) => skillId === null || session.skillId === skillId
  )
  const details = data.details.filter((detail) => skillId === null || detail.skillId === skillId)

  // The skill being looked at: the one chosen, or the only one that has sessions. Its unit and its
  // measures shape the cards; with several skills mixed there is no single unit to speak in.
  const shownId = skillId ?? (choices.length === 1 ? choices[0] : undefined)
  const progress = skills.find((skill) => skill.id === shownId)?.progress
  const measures = measureSeries(details, progress?.measures ?? [])

  const story = scoreStory(scorePoints(sessions, 'all', now))
  const streak = streakLength(data.sessions, now)

  // What comes next in the path being followed.
  const path = data.path
  const nextProgress = path?.progress.steps.find((item) => item.state === 'current')
  const nextStep = path?.path.steps.find((item) => item.id === nextProgress?.stepId)

  const goNext = (card: Element | null): void => {
    if (nextStep?.kind === 'skill') {
      const skillToPractise = nextStep.skillId
      startWithExpand(card, () => {
        selectSkill(skillToPractise)
        go('calibration')
      })
    } else {
      go('path')
    }
  }
  const askCoach = (): void => {
    go('home')
    focusComposer()
  }

  const hasBefore = data.details.some((detail) => {
    const age = daysAgo(detail.startedAt, now)
    return age >= 28 && age < 56
  })

  return (
    <section className="mx-auto flex h-full w-full max-w-335 flex-col gap-4 self-start overflow-y-auto px-4.5 pt-3.5 pb-12">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-5 px-1 pt-1.5">
        <h1>
          <span className="block text-[0.8125rem] font-bold tracking-[0.14em] text-accent uppercase">
            {t('screen.dashboard.title')}
          </span>
          <span className="mt-2 block font-display text-[2.375rem] leading-tight font-bold tracking-[-0.03em]">
            {t(
              data.sessions.length === 0
                ? 'dashboard.headline.empty'
                : story.kind === 'rise'
                  ? 'dashboard.headline.rise'
                  : 'dashboard.headline.default'
            )}
          </span>
        </h1>
        {choices.length > 1 && (
          <div
            role="group"
            aria-label={t('dashboard.filter.label')}
            className="glass flex max-w-full gap-1 overflow-x-auto rounded-full p-1.25"
          >
            {[null, ...choices].map((choice) => (
              <button
                key={choice ?? 'all'}
                type="button"
                aria-pressed={skillId === choice}
                onClick={() => setSkillId(choice)}
                className="h-9 rounded-full px-3.5 text-[0.8125rem] font-semibold whitespace-nowrap text-mut transition-all duration-200 aria-pressed:bg-grad aria-pressed:text-on-brand"
              >
                {choice === null ? t('dashboard.filter.all') : skillDisplayName(choice)}
              </button>
            ))}
          </div>
        )}
      </div>

      {data.sessions.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-3xl border border-dashed border-line/10 p-10">
          <p className="text-xl font-semibold">{t('progress.empty')}</p>
          <p className="max-w-lg text-mut">{t('dashboard.empty.body')}</p>
          <Button size="lg" onClick={() => go('library')}>
            {t('progress.start')}
          </Button>
        </div>
      ) : (
        <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-12">
          <ScoreCard key={skillId ?? 'all'} sessions={sessions} now={now} />
          <ActiveRouteCard
            current={path}
            onContinue={goNext}
            onOpen={() => go('path')}
            onAsk={askCoach}
            onLibrary={() => go('library')}
          />
          <ConsistencyCard sessions={sessions} now={now} streak={streak} />
          <ErrorsCard rows={errorRows(details, skills, now)} hasBefore={hasBefore} />
          <QualityCard detail={details[0]} unit={progress?.unit ?? 'reps'} />
          <ChannelCards series={channelSeries(details, skills)} />
          {measures.length > 0 && <MeasuresCards series={measures} />}
          <HistoryList sessions={sessions} details={details} />
        </div>
      )}
    </section>
  )
}
