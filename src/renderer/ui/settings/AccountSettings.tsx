import { useEffect, useState } from 'react'
import { t, type MessageKey } from '@renderer/i18n'
import type { SyncInfo } from '@shared/account'
import { deleteAccount, requestSignOut, useAccount } from '../accountStore'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { syncLine } from '../syncText'
import { SettingsCard } from './SettingsCard'

// How often the page asks how the sync is doing while it is looking at it.
const REFRESH_MS = 5000

function useSyncInfo(): SyncInfo | null {
  const [info, setInfo] = useState<SyncInfo | null>(null)
  useEffect(() => {
    let alive = true
    const load = (): void => {
      window.api.account
        .syncInfo()
        .then((next) => alive && setInfo(next))
        .catch(() => undefined)
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])
  return info
}

type Step = 'idle' | 'confirm' | 'working' | 'failed'

const DELETE_ERROR: Record<'network' | 'unknown', MessageKey> = {
  network: 'account.delete.error.network',
  unknown: 'account.delete.error.unknown'
}

// The account: who is signed in, how the sync is doing, what is synced, signing out and deleting the
// account (D21).
export function AccountSettings(): React.JSX.Element {
  const status = useAccount((state) => state.status)
  const email = typeof status === 'object' && status.state === 'signed-in' ? status.email : null
  const info = useSyncInfo()
  const [step, setStep] = useState<Step>('idle')
  const [failure, setFailure] = useState<'network' | 'unknown'>('unknown')

  const line = info ? syncLine(info) : null

  const erase = async (): Promise<void> => {
    setStep('working')
    try {
      const result = await deleteAccount(window.api)
      if (!result.ok) {
        setFailure(result.error === 'network' ? 'network' : 'unknown')
        setStep('failed')
      }
      // When it worked the page goes back to the sign-in: there is nothing left to show here.
    } catch {
      setFailure('unknown')
      setStep('failed')
    }
  }

  return (
    <>
      <SettingsCard title={t('account.settings.title')}>
        {email && <p className="text-[0.9375rem] font-semibold">{email}</p>}
        {line && (
          <p role="status" className="text-sm text-mut">
            {t(line.key, line.params)}
          </p>
        )}
      </SettingsCard>

      <SettingsCard title={t('account.share.title')} description={t('account.share.body')}>
        <></>
      </SettingsCard>

      <SettingsCard title={t('account.session.title')}>
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => void requestSignOut(window.api)}
        >
          {t('account.signOut')}
        </Button>
      </SettingsCard>

      <SettingsCard title={t('account.delete.title')} description={t('account.delete.body')}>
        {step === 'idle' || step === 'failed' ? (
          <Button variant="danger" className="self-start" onClick={() => setStep('confirm')}>
            {t('account.delete.button')}
          </Button>
        ) : (
          <Card
            role="alertdialog"
            aria-label={t('account.delete.question')}
            className="flex flex-col gap-3 border-bad/40 p-5"
          >
            <p className="font-semibold">{t('account.delete.question')}</p>
            <div className="flex gap-2.5">
              <Button variant="danger" disabled={step === 'working'} onClick={() => void erase()}>
                {t(step === 'working' ? 'account.delete.working' : 'account.delete.confirm')}
              </Button>
              <Button
                variant="secondary"
                disabled={step === 'working'}
                onClick={() => setStep('idle')}
              >
                {t('settings.delete.cancel')}
              </Button>
            </div>
          </Card>
        )}
        {step === 'failed' && (
          <p role="alert" className="text-sm text-bad-text">
            {t(DELETE_ERROR[failure])}
          </p>
        )}
      </SettingsCard>
    </>
  )
}
