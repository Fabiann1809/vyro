import { t, type MessageKey } from '@renderer/i18n'
import type { SessionDetail } from '@shared/sessions'
import { EmptyChart } from '../charts/EmptyChart'
import { QualityBars } from '../charts/QualityBars'
import { QUALITY_FILL, type Quality } from '../charts/quality'
import { fatigueStory, repQualities } from '../dashboardData'
import { Card } from '../kit/Card'
import { skillDisplayName } from '../skillName'

const QUALITY_WORD: Record<Quality, MessageKey> = {
  good: 'dashboard.quality.good',
  warn: 'dashboard.quality.warn',
  bad: 'dashboard.quality.bad'
}

// How each repetition of the last session went, in order: a technique that wears out shows as bars
// that shrink towards the end.
export function QualityCard({ detail }: { detail: SessionDetail | undefined }): React.JSX.Element {
  const qualities = detail ? repQualities(detail) : []
  const story = fatigueStory(qualities)
  const skill = detail ? skillDisplayName(detail.skillId) : ''

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <p className="text-[0.8125rem] text-mut">{t('dashboard.quality.label', { skill })}</p>
        <h2 className="mt-1 text-[1.1875rem] font-semibold">
          {t(
            story.kind === 'wears-out'
              ? 'dashboard.quality.wears'
              : story.kind === 'steady'
                ? 'dashboard.quality.steady'
                : 'dashboard.quality.tooFew'
          )}
        </h2>
        {story.kind === 'wears-out' && (
          <p className="mt-1 text-[0.84rem] text-mut">
            {t('dashboard.quality.wearsSub', {
              half: story.half,
              first: story.firstFailures,
              last: story.lastFailures
            })}
          </p>
        )}
      </div>

      {qualities.length === 0 ? (
        <EmptyChart message={t('dashboard.quality.empty')} />
      ) : (
        <QualityBars
          qualities={qualities}
          labels={qualities.map((quality, index) =>
            t('dashboard.quality.rep', { n: index + 1, quality: t(QUALITY_WORD[quality]) })
          )}
          summary={t('dashboard.quality.summary', { count: qualities.length })}
          height="min-h-36 flex-1"
        />
      )}

      <ul className="flex gap-3.5 text-xs text-mut">
        {(['good', 'warn', 'bad'] as const).map((quality) => (
          <li key={quality} className="flex items-center gap-1.5">
            <span className={`h-3 w-2 rounded-[2px] ${QUALITY_FILL[quality]}`} aria-hidden="true" />
            {t(QUALITY_WORD[quality])}
          </li>
        ))}
      </ul>
    </Card>
  )
}
