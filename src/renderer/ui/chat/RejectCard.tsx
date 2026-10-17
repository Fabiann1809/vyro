import { t } from '@renderer/i18n'
import type { PlanOutcome } from '../pathPlanStore'
import { channelList, REASON_TEXT } from '../feasibilityText'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { Icon } from '../kit/Icon'

type Refusal = Exclude<PlanOutcome, { kind: 'path' }>

function Reasons({ outcome }: { outcome: Refusal }): React.JSX.Element {
  if (outcome.kind === 'out-of-scope') {
    return (
      <>
        <h2 className="text-lg font-semibold">{t('path.outcome.outOfScope.title')}</h2>
        <ul className="flex list-inside list-disc flex-col gap-1 text-[0.9rem] text-t4">
          {outcome.reasons.map((reason) => (
            <li key={reason}>{t(REASON_TEXT[reason])}</li>
          ))}
        </ul>
        {outcome.measurable.length > 0 && (
          <p className="text-[0.9rem] text-mut">
            {t('path.outcome.measurable', { channels: channelList(outcome.measurable) })}
          </p>
        )}
      </>
    )
  }
  if (outcome.kind === 'planned') {
    return (
      <>
        <h2 className="text-lg font-semibold">{t('path.outcome.planned.title')}</h2>
        <p className="text-[0.9rem] text-mut">
          {t('path.outcome.planned.body', {
            channels: channelList(outcome.pending.map((item) => item.channel))
          })}
        </p>
      </>
    )
  }
  return (
    <>
      <h2 className="text-lg font-semibold">{t('path.outcome.noSkill.title')}</h2>
      <p className="text-[0.9rem] text-mut">{t('path.outcome.noSkill.body')}</p>
    </>
  )
}

// Why the coach cannot make a path for what was asked, and what it could measure instead.
export function RejectCard({
  outcome,
  onRestart
}: {
  outcome: Refusal
  onRestart: () => void
}): React.JSX.Element {
  return (
    <Card role="status" className="anim-up ml-13 flex flex-col items-start gap-3 p-6">
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-full bg-warn/15 text-warn-text"
      >
        <Icon name="warning" className="size-4.5" strokeWidth={1.5} />
      </span>
      <Reasons outcome={outcome} />
      <Button variant="secondary" className="mt-1" onClick={onRestart}>
        {t('reject.restart')}
      </Button>
    </Card>
  )
}
