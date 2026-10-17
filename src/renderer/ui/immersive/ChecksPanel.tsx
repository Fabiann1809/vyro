import { t, type MessageKey } from '@renderer/i18n'
import type { CheckState } from '@renderer/core/framing'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { Card } from '../kit/Card'
import { ChannelChip } from '../kit/ChannelChip'
import { CHANNEL_ORDER } from '../kit/channels'
import { sortChannels } from '../kit/channels'

export interface CheckItem {
  id: string
  label: MessageKey
  state: CheckState
  channel: SkillChannel
}

// Never colour alone: every state has its own words for a screen reader and its own shape.
const STATE_WORD: Record<CheckState, MessageKey> = {
  pending: 'calibration.state.pending',
  ok: 'calibration.state.ok',
  fix: 'calibration.state.fix'
}

function Mark({ state }: { state: CheckState }): React.JSX.Element {
  if (state === 'ok') {
    return (
      <span
        aria-hidden="true"
        className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M3.5 8.5l3 3 6-7"
            strokeDasharray={20}
            style={{ animation: 'vy-check 360ms ease-out both' }}
          />
        </svg>
      </span>
    )
  }
  if (state === 'fix') {
    return (
      <span
        aria-hidden="true"
        className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-warn text-sm font-bold text-on-brand"
      >
        ✗
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className="size-6.5 shrink-0 rounded-full border-2 border-dashed border-line/30"
      style={{ animation: 'vy-spin 3s linear infinite' }}
    />
  )
}

// What still has to be right before the practice starts, one group for each thing the skill watches:
// the body, the hands, the object, the sound.
export function ChecksPanel({ checks }: { checks: readonly CheckItem[] }): React.JSX.Element {
  const channels = sortChannels(
    CHANNEL_ORDER.filter((c) => checks.some((check) => check.channel === c))
  )

  return (
    <Card className="flex flex-col gap-4 p-5">
      <p className="text-[0.8125rem] text-mut">{t('calibration.checks.title')}</p>
      {channels.map((channel) => {
        const own = checks.filter((check) => check.channel === channel)
        return (
          <div key={channel} role="group" className="flex flex-col gap-1.5">
            <span className="self-start">
              <ChannelChip channel={channel} />
            </span>
            <ul className="flex flex-col">
              {own.map((check) => (
                <li key={check.id} className="flex items-center gap-3.5 py-1.5">
                  <Mark state={check.state} />
                  <span className="flex-1 text-base font-medium">{t(check.label)}</span>
                  <span className="sr-only">: {t(STATE_WORD[check.state])}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </Card>
  )
}
