import { useEffect, useRef, useState } from 'react'
import { t } from '@renderer/i18n'
import type { ThreadItem } from '../homeChatStore'
import { CoachAvatar } from '../kit/CoachAvatar'
import { useReducedMotion } from '../useReducedMotion'
import { useTypewriter } from '../useTypewriter'
import { InviteCard } from './InviteCard'
import { RejectCard } from './RejectCard'
import { RouteCard } from './RouteCard'

export interface ThreadActions {
  onStartRoute: () => void
  onViewRoute: () => void
  onAdjustRoute: () => void
  onRestart: () => void
  onEnableAi: () => void
  onOpenLibrary: () => void
}

// A reply of the coach. It is written out letter by letter only when it arrives while the person is
// looking; a screen reader gets the whole text at once, not the letters as they come.
function CoachMessage({ text, animate }: { text: string; animate: boolean }): React.JSX.Element {
  const shown = useTypewriter(text, animate)
  const typing = shown.length < text.length

  return (
    <div className="flex max-w-[86%] items-start gap-3.5">
      <CoachAvatar />
      <p className="pt-1.5 text-[1.03rem] leading-relaxed text-t2 text-pretty whitespace-pre-wrap">
        {/* The real text is always there, for screen readers and for copying; while the reply is
            being written the people who can see get the letters that have come so far. */}
        <span className={typing ? 'sr-only' : undefined}>{text}</span>
        {typing && <span aria-hidden="true">{shown}</span>}
      </p>
    </div>
  )
}

function UserMessage({ text }: { text: string }): React.JSX.Element {
  return (
    <p className="anim-up max-w-[70%] self-end rounded-[1.375rem_1.375rem_0.375rem_1.375rem] bg-fill px-4.5 py-3 text-base leading-normal whitespace-pre-wrap">
      {text}
    </p>
  )
}

// The conversation, as a log that a screen reader announces as it grows.
export function Thread({
  items,
  pending,
  actions
}: {
  items: readonly ThreadItem[]
  pending: boolean
  actions: ThreadActions
}): React.JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  // What was already there when the screen opened is not written out again.
  const [settled] = useState(items.length)

  // Instant, not animated: it is a jump to the last message, and some people ask for no motion.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [items.length, pending])

  return (
    <div
      role="log"
      aria-label={t('coach.log')}
      aria-live="polite"
      aria-relevant="additions"
      className="min-h-0 flex-1 overflow-y-auto px-10 py-7"
    >
      <div className="mx-auto flex max-w-195 flex-col gap-5">
        {items.map((item, index) => {
          switch (item.kind) {
            case 'user':
              return <UserMessage key={item.key} text={item.text} />
            case 'coach':
              return (
                <CoachMessage
                  key={item.key}
                  text={item.text}
                  animate={!reduceMotion && index >= settled}
                />
              )
            case 'route':
              return (
                <RouteCard
                  key={item.key}
                  path={item.path}
                  status={item.status}
                  onStart={actions.onStartRoute}
                  onView={actions.onViewRoute}
                  onAdjust={actions.onAdjustRoute}
                />
              )
            case 'reject':
              return (
                <RejectCard key={item.key} outcome={item.outcome} onRestart={actions.onRestart} />
              )
            case 'invite':
              return (
                <InviteCard
                  key={item.key}
                  onEnable={actions.onEnableAi}
                  onLibrary={actions.onOpenLibrary}
                />
              )
          }
        })}
        {pending && (
          <div role="status" className="flex items-center gap-3.5 text-sm text-mut">
            <CoachAvatar thinking />
            <span className="sr-only">{t('coach.thinking')}</span>
            <span aria-hidden="true" className="flex items-center gap-1.5">
              {t('home.thinking')}
              {[0, 0.2, 0.4].map((delay) => (
                <span key={delay} style={{ animation: `vy-dot 1.2s ${delay}s infinite` }}>
                  ●
                </span>
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
