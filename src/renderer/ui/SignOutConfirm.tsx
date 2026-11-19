import { t } from '@renderer/i18n'
import { cancelSignOut, requestSignOut, useAccount } from './accountStore'
import { Button } from './kit/Button'
import { Card } from './kit/Card'

// Asked when signing out was stopped because some changes could not be sent to the cloud: if the
// person goes on and another account signs in on this computer, those changes are lost.
export function SignOutConfirm(): React.JSX.Element | null {
  const pending = useAccount((state) => state.signOutPending)
  if (!pending) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6">
      <Card
        raised
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sign-out-title"
        aria-describedby="sign-out-body"
        className="flex w-full max-w-md flex-col gap-4 p-7"
      >
        <h2 id="sign-out-title" className="font-display text-xl font-extrabold">
          {t('account.signOut.pending.title')}
        </h2>
        <p id="sign-out-body" className="text-sm text-mut">
          {t('account.signOut.pending.body')}
        </p>
        <div className="flex flex-col gap-2.5">
          <Button size="lg" onClick={cancelSignOut}>
            {t('account.signOut.stay')}
          </Button>
          <Button variant="danger" onClick={() => void requestSignOut(window.api, true)}>
            {t('account.signOut.anyway')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
