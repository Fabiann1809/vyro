import { t, type MessageKey } from '@renderer/i18n'
import { focusComposer } from '../focusComposer'
import { Button } from '../kit/Button'
import { Icon } from '../kit/Icon'
import type { IconName } from '../kit/icons'
import { useNavigation } from '../navigation'

// Each step is an orb of its own colour. The colours come from the interface (the brand and the
// channels), so they follow the theme.
const STEPS: ReadonlyArray<{
  title: MessageKey
  body: MessageKey
  icon: IconName
  color: string
}> = [
  { title: 'how.step.1.title', body: 'how.step.1.body', icon: 'chat', color: 'var(--brand)' },
  { title: 'how.step.2.title', body: 'how.step.2.body', icon: 'route', color: 'var(--ch-hands)' },
  { title: 'how.step.3.title', body: 'how.step.3.body', icon: 'audio', color: 'var(--ch-audio)' },
  { title: 'how.step.4.title', body: 'how.step.4.body', icon: 'chart', color: 'var(--good)' }
]

const TRUST: ReadonlyArray<{ title: MessageKey; body: MessageKey; icon: IconName }> = [
  { title: 'how.trust.private.title', body: 'how.trust.private.body', icon: 'shield' },
  { title: 'how.trust.offline.title', body: 'how.trust.offline.body', icon: 'offline' },
  { title: 'how.trust.measure.title', body: 'how.trust.measure.body', icon: 'target' }
]

export function HowScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)

  return (
    <section className="mx-auto flex h-full w-full max-w-310 flex-col gap-7 self-start overflow-y-auto px-6 pt-5 pb-12">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="max-w-160 font-display text-[3.25rem] leading-none font-bold tracking-[-0.035em]">
            {t('screen.how.title')}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-mut">{t('how.lead')}</p>
        </div>
        <Button
          size="lg"
          onClick={() => {
            go('home')
            focusComposer()
          }}
        >
          {t('how.cta')}
        </Button>
      </div>

      <div className="glass relative shrink-0 rounded-[2.25rem] px-7.5 pt-9 pb-7.5">
        <svg
          viewBox="0 0 1000 120"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute top-14 right-[calc(1.875rem+6%)] left-[calc(1.875rem+6%)] h-30 overflow-visible"
        >
          <defs>
            <linearGradient id="vy-how-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#FFD1A0" />
              <stop offset="0.5" stopColor="#F27A3E" />
              <stop offset="1" stopColor="#D2497A" />
            </linearGradient>
          </defs>
          <path
            d="M0 60 C 125 0, 125 120, 250 60 S 375 0, 500 60 S 625 120, 750 60 S 875 0, 1000 60"
            fill="none"
            stroke="url(#vy-how-line)"
            strokeWidth="2.5"
            strokeDasharray="4 8"
            vectorEffect="non-scaling-stroke"
            opacity="0.7"
          />
        </svg>
        <ol className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="anim-up flex flex-col items-center gap-3.5 text-center"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <span
                aria-hidden="true"
                className="relative flex size-30 items-center justify-center rounded-full text-[#2a0f1a] shadow-[inset_0_-10px_20px_rgba(60,10,30,0.25)]"
                style={{
                  background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.4), ${step.color} 60%)`,
                  boxShadow: `0 0 50px color-mix(in oklab, ${step.color} 45%, transparent), inset 0 -10px 20px rgba(60,10,30,0.25)`,
                  animation: `vy-float 6s ${index * 0.8}s ease-in-out infinite`
                }}
              >
                <Icon name={step.icon} className="size-11.5" strokeWidth={1.5} />
                <span className="absolute -top-1 -right-1 flex size-8.5 items-center justify-center rounded-full bg-t1 font-display text-[0.9375rem] font-extrabold text-inv">
                  {index + 1}
                </span>
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">{t(step.title)}</h2>
                <p className="mt-1.5 text-sm text-mut">{t(step.body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <ul className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-3">
        {TRUST.map((block) => (
          <li
            key={block.title}
            className="glass flex flex-col gap-3 rounded-[2rem] p-6.5 transition-transform duration-300 hover:-translate-y-1"
          >
            <span
              aria-hidden="true"
              className="flex size-13 items-center justify-center rounded-[1.125rem] bg-brand/16 text-accent"
            >
              <Icon name={block.icon} className="size-6.5" strokeWidth={1.6} />
            </span>
            <h2 className="text-xl font-bold">{t(block.title)}</h2>
            <p className="text-[0.9rem] leading-normal text-mut">{t(block.body)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
