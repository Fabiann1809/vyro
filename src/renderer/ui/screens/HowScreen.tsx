import { t } from '@renderer/i18n'
import { Button } from '../kit/Button'
import { focusComposer } from '../focusComposer'
import { useNavigation } from '../navigation'

export function HowScreen(): React.JSX.Element {
  const go = useNavigation((state) => state.go)

  return (
    <section className="flex w-full max-w-4xl flex-col items-start gap-5 self-start p-8">
      <h1 className="font-display text-4xl font-semibold">{t('screen.how.title')}</h1>
      <p className="max-w-xl text-lg text-mut">{t('how.lead')}</p>
      <Button
        size="lg"
        onClick={() => {
          go('home')
          focusComposer()
        }}
      >
        {t('how.cta')}
      </Button>
    </section>
  )
}
