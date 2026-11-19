import { useState } from 'react'
import { t } from '@renderer/i18n'
import type { AuthFailure, AuthResult } from '@shared/account'
import { applyResult, clearReturnError, useAccount } from '../accountStore'
import { FAILURE_TEXT } from '../accountErrors'
import { Ambient } from '../kit/Ambient'
import { Button } from '../kit/Button'
import { Card } from '../kit/Card'
import { FIELD, FIELD_LABEL } from '../kit/fields'
import { Icon } from '../kit/Icon'
import { Mark } from '../kit/Mark'

type Mode = 'signIn' | 'signUp' | 'verify' | 'forgot' | 'reset'

const TITLE = {
  signIn: 'account.title.signIn',
  signUp: 'account.title.signUp',
  verify: 'account.title.verify',
  forgot: 'account.title.forgot',
  reset: 'account.title.reset'
} as const

const SUBMIT = {
  signIn: 'account.signIn',
  signUp: 'account.signUp',
  verify: 'account.verify',
  forgot: 'account.sendCode',
  reset: 'account.reset'
} as const

// Modes that begin with a short explanation under the title; the others say something of their own.
const INTRO = {
  signIn: 'account.intro.signIn',
  signUp: 'account.intro.signUp',
  forgot: 'account.intro.forgot'
} as const

function Field({
  label,
  hint,
  ...input
}: {
  label: string
  hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  // The hint is not part of the label, so the name of the field stays what it says.
  const hintId = hint ? `${input.name}-hint` : undefined
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>{label}</span>
        <input {...input} aria-describedby={hintId} className={`${FIELD} w-full`} />
      </label>
      {hint && (
        <span id={hintId} className="text-xs text-mut2">
          {hint}
        </span>
      )}
    </div>
  )
}

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
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

// The page that closes the app to anyone who has not signed in (D21). It is also the page that says
// so when this build has no account service to sign in to.
export function AccountScreen(): React.JSX.Element {
  const status = useAccount((state) => state.status)
  const returnError = useAccount((state) => state.returnError)
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [waitingForGoogle, setWaitingForGoogle] = useState(false)
  const [error, setError] = useState<AuthFailure | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // A sign-in that comes back from the browser with a failure is shown like any other failure,
  // and it ends the wait.
  const shownError = error ?? returnError
  const googleWaiting = waitingForGoogle && returnError === null

  if (typeof status === 'object' && status.state === 'unconfigured') {
    return (
      <Frame>
        <div className="flex flex-col gap-3">
          <Icon name="warning" className="size-7 text-warn-text" />
          <h1 className="font-display text-2xl font-extrabold">
            {t('account.unconfigured.title')}
          </h1>
          <p className="text-sm text-mut">{t('account.unconfigured.body')}</p>
        </div>
      </Frame>
    )
  }

  const account = window.api.account

  const go = (next: Mode): void => {
    setMode(next)
    clearReturnError()
    setError(null)
    setNotice(null)
    setCode('')
    setWaitingForGoogle(false)
  }

  // Runs one call: shows what went wrong, or applies the account it returned.
  async function run(call: () => Promise<AuthResult>, onOk?: () => void): Promise<void> {
    setBusy(true)
    clearReturnError()
    setError(null)
    setNotice(null)
    try {
      const result = await call()
      if (result.ok) {
        applyResult(result)
        onOk?.()
      } else {
        setError(result.error)
        // The email exists but was never confirmed: the code is what is missing.
        if (result.error === 'email-not-confirmed' && mode === 'signIn') setMode('verify')
      }
    } catch {
      setError('unknown')
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (mode === 'signIn') void run(() => account.signIn({ email, password }))
    else if (mode === 'signUp') {
      void run(
        () => account.signUp({ email, password }),
        () => {
          setMode('verify')
          setNotice(t('account.verify.sent', { email }))
        }
      )
    } else if (mode === 'verify') void run(() => account.verifyEmailCode({ email, code }))
    else if (mode === 'forgot') {
      void run(
        () => account.requestPasswordReset({ email }),
        () => {
          setMode('reset')
          setPassword('')
          setNotice(t('account.reset.sent', { email }))
        }
      )
    } else void run(() => account.resetPassword({ email, code, password }))
  }

  const resend = (): void => {
    void run(
      () => account.signUp({ email, password }),
      () => setNotice(t('account.resent'))
    )
  }

  const google = async (): Promise<void> => {
    setError(null)
    clearReturnError()
    setBusy(true)
    try {
      const result = await account.signInWithGoogle()
      if (result.ok) setWaitingForGoogle(true)
      else setError(result.error)
    } catch {
      setError('unknown')
    } finally {
      setBusy(false)
    }
  }

  const intro = mode in INTRO ? INTRO[mode as keyof typeof INTRO] : null

  return (
    <Frame>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-extrabold">{t(TITLE[mode])}</h1>
        {intro && <p className="text-sm text-mut">{t(intro)}</p>}
        {notice && (
          <p role="status" className="text-sm text-mut">
            {notice}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={busy}>
        {mode !== 'verify' && (
          <Field
            label={t('account.email')}
            type="email"
            name="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
        {(mode === 'signIn' || mode === 'signUp') && (
          <Field
            label={t('account.password')}
            hint={mode === 'signUp' ? t('account.passwordHint') : undefined}
            type="password"
            name="password"
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
        {(mode === 'verify' || mode === 'reset') && (
          <Field
            label={t('account.code')}
            type="text"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        )}
        {mode === 'reset' && (
          <Field
            label={t('account.newPassword')}
            hint={t('account.passwordHint')}
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}

        {shownError && (
          <p role="alert" className="text-sm text-bad-text">
            {t(FAILURE_TEXT[shownError])}
          </p>
        )}

        <Button type="submit" size="lg" disabled={busy}>
          {t(busy ? 'account.working' : SUBMIT[mode])}
        </Button>
      </form>

      {mode === 'signIn' && (
        <>
          <div className="flex items-center gap-3 text-xs text-mut2" aria-hidden="true">
            <span className="h-px flex-1 bg-line/10" />
            {t('account.or')}
            <span className="h-px flex-1 bg-line/10" />
          </div>
          {googleWaiting ? (
            <div className="flex flex-col gap-3">
              <p role="status" className="text-sm text-mut">
                {t('account.google.waiting')}
              </p>
              <Button variant="ghost" onClick={() => setWaitingForGoogle(false)}>
                {t('account.google.cancel')}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="lg" disabled={busy} onClick={() => void google()}>
              {t('account.google')}
            </Button>
          )}
        </>
      )}

      <div className="flex flex-col items-center gap-1 text-sm">
        {mode === 'signIn' && (
          <>
            <Button variant="ghost" onClick={() => go('forgot')}>
              {t('account.forgot')}
            </Button>
            <Button variant="ghost" onClick={() => go('signUp')}>
              {t('account.toSignUp')}
            </Button>
          </>
        )}
        {mode === 'signUp' && (
          <Button variant="ghost" onClick={() => go('signIn')}>
            {t('account.toSignIn')}
          </Button>
        )}
        {mode === 'verify' && (
          <>
            <Button variant="ghost" disabled={busy} onClick={resend}>
              {t('account.resend')}
            </Button>
            <Button variant="ghost" onClick={() => go('signIn')}>
              {t('account.back')}
            </Button>
          </>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <Button variant="ghost" onClick={() => go('signIn')}>
            {t('account.back')}
          </Button>
        )}
      </div>
    </Frame>
  )
}
