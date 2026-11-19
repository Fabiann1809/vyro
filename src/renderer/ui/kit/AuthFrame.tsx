import { t } from '@renderer/i18n'
import { Ambient } from './Ambient'
import { Card } from './Card'
import { Mark } from './Mark'

// The page that stands alone, before the app opens: the sign-in, and what to do with the data that was
// on this computer before the account.
export function AuthFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="relative flex h-screen items-center justify-center overflow-auto bg-bg p-6 text-t1">
      <Ambient />
      <Card raised className="relative z-10 flex w-full max-w-104 flex-col gap-5 p-8">
        <div className="flex items-center gap-3">
          <Mark />
          <div className="flex flex-col">
            <span className="font-display text-xl leading-none font-extrabold tracking-[0.16em]">
              VYRO
            </span>
            <span className="mt-1 text-[0.6875rem] tracking-[0.04em] text-mut">
              {t('account.tagline')}
            </span>
          </div>
        </div>
        {children}
      </Card>
    </div>
  )
}
