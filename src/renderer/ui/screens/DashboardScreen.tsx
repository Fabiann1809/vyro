import { useState } from 'react'
import { t } from '@renderer/i18n'
import { ActiveRouteCard } from '../dashboard/ActiveRouteCard'
import { ChannelCards } from '../dashboard/ChannelCards'
import { ConsistencyCard } from '../dashboard/ConsistencyCard'
import { ErrorsCard } from '../dashboard/ErrorsCard'
import { HistoryList } from '../dashboard/HistoryList'
import { QualityCard } from '../dashboard/QualityCard'
import { ScoreCard } from '../dashboard/ScoreCard'
import { StreakStrip } from '../dashboard/StreakStrip'
import { useDashboardData } from '../dashboard/useDashboardData'
import {
  channelSeries,
  daysAgo,
  errorRows,
  scorePoints,
  scoreStory,
  streakLength
} from '../dashboardData'
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

  const story = scoreStory(scorePoints(sessions, 'all', now))
  const streak = streakLength(data.sessions, now)

  // What comes next in the path being followed.
  const path = data.path
  const nextProgress = path?.progress.steps.find((item) => item.state === 'current')
  const nextStep = path?.path.steps.find((item) => item.id === nextProgress?.stepId)
  const next =
    path && nextStep
      ? { title: nextStep.title, step: nextStep.position, total: path.path.steps.length }
      : null

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
    <section className="mx-auto flex h-full w-full max-w-[82rem] flex-col gap-5 self-start overflow-y-auto px-8 pt-7 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-[2.125rem] leading-tight font-semibold tracking-tight">
            {t('screen.dashboard.title')}
          </h1>
          <p className="mt-1.5 text-mut">
            {t(
              data.sessions.length === 0
                ? 'dashboard.headline.empty'
                : story.kind === 'rise'
                  ? 'dashboard.headline.rise'
                  : 'dashboard.headline.default'
            )}
          </p>
        </div>
        {choices.length > 1 && (
          <div
            role="group"
            aria-label={t('dashboard.filter.label')}
            className="flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-line/6 bg-card p-1"
          >
            {[null, ...choices].map((choice) => (
              <button
                key={choice ?? 'all'}
                type="button"
                aria-pressed={skillId === choice}
                onClick={() => setSkillId(choice)}
                className="h-8.5 rounded-full px-3.5 text-[0.8125rem] whitespace-nowrap text-mut transition-colors aria-pressed:bg-seg aria-pressed:text-t1"
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
        <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <StreakStrip
              streak={streak}
              next={next}
              onContinue={goNext}
              onLibrary={() => go('library')}
            />
          </div>
          <ScoreCard key={skillId ?? 'all'} sessions={sessions} now={now} />
          <ActiveRouteCard current={path} onOpen={() => go('path')} onAsk={askCoach} />
          <ConsistencyCard sessions={sessions} now={now} />
          <QualityCard detail={details[0]} />
          <ErrorsCard rows={errorRows(details, skills, now)} hasBefore={hasBefore} />
          <ChannelCards series={channelSeries(details, skills)} />
          <HistoryList sessions={sessions} details={details} />
        </div>
      )}
    </section>
  )
}
