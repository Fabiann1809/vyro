import { t } from '@renderer/i18n'
import type { PathToSave } from '@shared/paths'
import { skillChannels, type SkillChannel } from '@shared/skill/skillChannels'
import type { RouteStatus } from '../homeChatStore'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { ChannelChips, ChannelMark } from '../kit/ChannelChip'
import { sortChannels } from '../kit/channels'
import { findSkill } from '../skillsStore'

// The channels a step of the path asks for; an auxiliary step, or a skill that is not known, asks for none.
function stepChannels(step: PathToSave['steps'][number]): SkillChannel[] {
  if (step.kind !== 'skill') return []
  const skill = findSkill(step.skillId)
  return skill ? sortChannels(skillChannels(skill)) : []
}

// The path the coach proposes, inside the conversation. It is only kept when the person says so.
export function RouteCard({
  path,
  status,
  onStart,
  onView,
  onAdjust
}: {
  path: PathToSave
  status: RouteStatus
  onStart: () => void
  onView: () => void
  onAdjust: () => void
}): React.JSX.Element {
  const rows = path.steps.map((step) => ({ step, channels: stepChannels(step) }))
  const channels = sortChannels([...new Set(rows.flatMap((row) => row.channels))])
  const busy = status === 'saving'
  const saved = status === 'saved'

  return (
    <Card raised data-card="route" className="anim-up ml-13 flex flex-col gap-5 p-6.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-mut uppercase">
            {t('route.kicker')}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">{path.goal}</h2>
        </div>
        <p className="shrink-0 text-right font-display text-[1.375rem] font-semibold">
          {t('route.steps', { count: path.steps.length })}
        </p>
      </div>

      {channels.length > 0 && <ChannelChips channels={channels} />}

      <ol className="flex flex-col">
        {rows.map(({ step, channels: stepOf }, index) => (
          <li
            key={index}
            style={{ animationDelay: `${300 + index * 110}ms` }}
            className="anim-up flex items-center gap-3.5 border-t border-line/5 py-2.5"
          >
            <span
              aria-hidden="true"
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-semibold text-t4 ${
                step.kind === 'skill'
                  ? 'border border-line/15'
                  : 'border border-dashed border-line/30'
              }`}
            >
              {index + 1}
            </span>
            <span className="flex-1 text-[0.9375rem]">
              <span className="sr-only">{index + 1}. </span>
              {step.title}
            </span>
            {step.kind === 'auxiliary' ? (
              <span className="text-xs text-mut2">{t('route.step.auxiliary')}</span>
            ) : (
              <span className="flex gap-1">
                {stepOf.map((channel) => (
                  <ChannelMark key={channel} channel={channel} />
                ))}
              </span>
            )}
          </li>
        ))}
      </ol>

      {status === 'failed' && (
        <p role="alert" className="text-sm text-bad-text">
          {t('route.failed')}
        </p>
      )}
      {saved && (
        <p role="status" className="flex items-center gap-2 text-sm text-good-text">
          <span aria-hidden="true">✓</span> {t('route.saved')}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button size="lg" onClick={onStart} disabled={busy}>
          {t(busy ? 'route.saving' : 'route.start')}
        </Button>
        <Button size="lg" variant="secondary" onClick={onView} disabled={busy}>
          {t('route.view')}
        </Button>
        {!saved && (
          <Button size="lg" variant="ghost" onClick={onAdjust} disabled={busy}>
            {t('route.adjust')}
          </Button>
        )}
      </div>
    </Card>
  )
}
