import { t } from '@renderer/i18n'
import type { SkillChannel } from '@shared/skill/skillChannels'
import { CHANNEL_LOOK } from '../kit/channels'
import { Icon } from '../kit/Icon'

// What the calibration and the practice are drawn on: the dark page, with two glows that do not move.
// They are plain gradients, with no blur and no animation, because the camera models are running
// behind this screen and it must stay cheap to draw (D20). The second glow takes the colour of the
// main channel of the skill.
export function ImmersiveFrame({
  channel,
  children
}: {
  channel: SkillChannel | undefined
  children: React.ReactNode
}): React.JSX.Element {
  const color = channel ? CHANNEL_LOOK[channel].color : 'var(--brand)'
  return (
    <section className="force-dark anim-fade relative flex h-full w-full flex-col gap-3.5 overflow-hidden bg-[#0e080b] px-5.5 pt-4.5 pb-5.5 text-t1">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-105 -left-75 size-200 rounded-full bg-[radial-gradient(closest-side,oklch(0.5_0.16_40/0.35),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-90 -bottom-120 size-225 rounded-full"
        style={{
          background: `radial-gradient(closest-side, color-mix(in oklab, ${color} 28%, transparent), transparent)`
        }}
      />
      {children}
    </section>
  )
}

// The top of the screen: the skill with its mark, what is being done (calibrating or practising),
// that nothing is kept, the time, and a way out.
export function ImmersiveHeader({
  name,
  channel,
  phase,
  audio,
  clock,
  exit
}: {
  name: string
  channel: SkillChannel | undefined
  // "Calibración" or "Entrenamiento".
  phase: string
  // Whether the sound is listened to as well as the picture seen: the privacy line says so.
  audio: boolean
  // The time of the practice; left out in the calibration.
  clock?: string
  // The way out, if the header has one.
  exit?: { label: string; onClick: () => void; shortcut?: string }
}): React.JSX.Element {
  const look = channel ? CHANNEL_LOOK[channel] : null
  const color = look?.color ?? 'var(--brand)'
  const privacy = t(audio ? 'training.privacyAudio' : 'training.privacy')

  return (
    <header className="relative flex shrink-0 items-center justify-between gap-5">
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-13 shrink-0 items-center justify-center rounded-full text-[#1a0f0c]"
          style={{
            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), ${color} 60%)`,
            boxShadow: `0 0 28px color-mix(in oklab, ${color} 45%, transparent)`
          }}
        >
          <Icon name={look?.icon ?? 'target'} className="size-6" strokeWidth={1.8} />
        </span>
        <h1 className="flex min-w-0 items-center gap-2.5">
          <span className="truncate font-display text-[1.375rem] font-bold">{name}</span>
          <span className="flex h-7 shrink-0 items-center rounded-full bg-grad px-3 text-xs font-extrabold whitespace-nowrap text-[#1a0f0c]">
            {phase}
          </span>
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <span
          role="img"
          aria-label={privacy}
          title={privacy}
          className="flex size-10 items-center justify-center rounded-full border border-line/10 bg-line/5 text-t2"
        >
          <Icon name={audio ? 'mic' : 'lock'} className="size-4.25" strokeWidth={1.7} />
        </span>
        {clock !== undefined && (
          <span className="flex h-10 items-center gap-2 rounded-full border border-line/10 bg-line/5 px-4 text-sm font-bold tabular-nums">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-bad"
              style={{ animation: 'vy-dot 1.6s infinite' }}
            />
            {clock}
          </span>
        )}
        {exit && (
          <button
            type="button"
            onClick={exit.onClick}
            aria-keyshortcuts={exit.shortcut}
            className="h-10 rounded-full border border-line/18 px-4.5 text-[0.84rem] whitespace-nowrap transition-colors hover:bg-line/9"
          >
            {exit.label}
            {exit.shortcut ? ` · ${exit.shortcut}` : ''}
          </button>
        )}
      </div>
    </header>
  )
}
