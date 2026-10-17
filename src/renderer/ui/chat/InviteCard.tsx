import { t } from '@renderer/i18n'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'

// What the coach answers when it is off: an invitation to turn it on, and a way to practise anyway.
export function InviteCard({
  onEnable,
  onLibrary
}: {
  onEnable: () => void
  onLibrary: () => void
}): React.JSX.Element {
  return (
    <Card className="anim-up ml-13 flex flex-col gap-3 p-6">
      <h2 className="text-lg leading-snug font-semibold text-pretty">{t('invite.title')}</h2>
      <p className="text-[0.9rem] leading-normal text-mut">{t('invite.body')}</p>
      <div className="mt-1.5 flex gap-2.5">
        <Button onClick={onEnable}>{t('invite.enable')}</Button>
        <Button variant="secondary" onClick={onLibrary}>
          {t('invite.library')}
        </Button>
      </div>
    </Card>
  )
}
