import { t, type MessageKey } from '@renderer/i18n'
import { focusComposer } from '../focusComposer'
import {
  ChartIllustration,
  ChatIllustration,
  RouteIllustration,
  SensorsIllustration
} from '../how/Illustrations'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { useNavigation } from '../navigation'

const STEPS: ReadonlyArray<{
  title: MessageKey
  body: MessageKey
  picture: () => React.JSX.Element
}> = [
  { title: 'how.step.1.title', body: 'how.step.1.body', picture: ChatIllustration },
  { title: 'how.step.2.title', body: 'how.step.2.body', picture: RouteIllustration },
  { title: 'how.step.3.title', body: 'how.step.3.body', picture: SensorsIllustration },
  { title: 'how.step.4.title', body: 'how.step.4.body', picture: ChartIllustration }
]

const TRUST: ReadonlyArray<{ title: MessageKey; body: MessageKey }> = [
  { title: 'how.trust.private.title', body: 'how.trust.private.body' },
  { title: 'how.trust.offline.title', body: 'how.trust.offline.body' },
  { title: 'how.trust.measure.title', body: 'how.trust.measure.body' }
]

export function HowScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)

  return (
    <section className="mx-auto flex h-full w-full max-w-300 flex-col gap-8 self-start overflow-y-auto px-8 pt-10 pb-14">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="max-w-160 font-display text-[2.75rem] leading-[1.1] font-semibold tracking-tight">
            {t('screen.how.title')}
          </h1>
          <p className="mt-3 max-w-xl text-lg text-mut">{t('how.lead')}</p>
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

      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => {
          const Picture = step.picture
          return (
            <li key={step.title} className="flex">
              <Card
                className="anim-up flex w-full flex-col gap-3.5 p-3 pb-5.5"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="h-42 overflow-hidden rounded-[1.125rem] bg-sunk p-3">
                  <Picture />
                </div>
                <div className="px-2">
                  <p aria-hidden="true" className="font-display text-[0.9375rem] text-accent">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">{t(step.title)}</h2>
                  <p className="mt-1.5 text-sm text-mut">{t(step.body)}</p>
                </div>
              </Card>
            </li>
          )
        })}
      </ol>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TRUST.map((block) => (
          <li key={block.title} className="rounded-3xl border border-line/8 p-6">
            <h2 className="text-lg font-semibold">{t(block.title)}</h2>
            <p className="mt-2 text-[0.9rem] leading-normal text-mut">{t(block.body)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
