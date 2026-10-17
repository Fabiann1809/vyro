import { t } from '@renderer/i18n'
import { skillChannels } from '@shared/skill/skillChannels'
import type { SessionDetail, SessionRow } from '@shared/sessions'
import { Sparkline } from '../charts/Sparkline'
import { repQualities } from '../dashboardData'
import { Card } from '../kit/Card'
import { ChannelMark } from '../kit/ChannelChip'
import { sortChannels } from '../kit/channels'
import { findSkill } from '../skillsStore'
import { skillDisplayName } from '../skillName'
import { formatDayAndTime } from './format'

// How tall each quality is on the little line of a row.
const HEIGHT = { good: 1, warn: 0.5, bad: 0 } as const

// The sessions that were kept, newest first, each with the shape of how it went.
export function HistoryList({
  sessions,
  details
}: {
  sessions: readonly SessionRow[]
  details: readonly SessionDetail[]
}): React.JSX.Element {
  return (
    <Card className="px-2 py-2.5 lg:col-span-3">
      <div className="flex items-baseline justify-between px-4.5 pt-3.5 pb-2.5">
        <h2 className="text-[1.1875rem] font-semibold">{t('dashboard.history.title')}</h2>
        <p className="text-[0.8125rem] text-mut">
          {t('dashboard.history.count', { count: sessions.length })}
        </p>
      </div>
      <ul>
        {sessions.slice(0, 30).map((session) => {
          const skill = findSkill(session.skillId)
          const channels = skill ? sortChannels(skillChannels(skill)) : []
          const detail = details.find((item) => item.id === session.id)
          const shape = detail ? repQualities(detail).map((quality) => HEIGHT[quality]) : []

          return (
            <li
              key={session.id}
              className="grid grid-cols-[7.5rem_minmax(0,1fr)_6.875rem_7.5rem_5rem] items-center gap-4 rounded-2xl border-t border-line/5 px-4.5 py-3.5"
            >
              <span className="text-[0.84rem] text-mut">{formatDayAndTime(session.startedAt)}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="truncate text-[0.9375rem] font-medium">
                  {skillDisplayName(session.skillId)}
                </span>
                {channels.map((channel) => (
                  <ChannelMark key={channel} channel={channel} className="size-3.75" />
                ))}
              </span>
              <span className="text-[0.84rem] text-t4">
                {t('summary.total', { count: session.repCount })}
              </span>
              <span>{shape.length >= 2 && <Sparkline values={shape} />}</span>
              <span className="text-right font-display text-lg font-semibold tabular-nums">
                {session.score === null ? '—' : session.score}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
