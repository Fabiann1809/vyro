import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import {
  EMAIL_CODE,
  GOOGLE_CODE_PREFIX,
  RATE_LIMITED_EMAIL,
  RESET_CODE,
  SHORT_LIVED_EMAIL,
  TEST_USER
} from './fakeAuth'

// The app is closed to anyone who has not signed in. These tests walk through the sign-in page
// against the fake account service that e2e/globalSetup.ts starts.

let userData: string
let app: ElectronApplication | undefined

test.beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), 'vyro-account-'))
})

test.afterEach(async () => {
  await app?.close()
  app = undefined
  rmSync(userData, { recursive: true, force: true })
})

async function launch(env: Record<string, string> = {}): Promise<Page> {
  app = await electron.launch({
    env: { ...process.env, ...env } as Record<string, string>,
    args: ['.', `--user-data-dir=${userData}`, ...(process.env['CI'] ? ['--no-sandbox'] : [])]
  })
  return app.firstWindow()
}

const bar = (page: Page): ReturnType<Page['getByRole']> =>
  page.getByRole('navigation', { name: 'Navegación principal' })
const freshEmail = (): string => `new-${Date.now()}-${Math.floor(Math.random() * 1e6)}@vyro.test`

async function fillSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Correo', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

// Whether this computer can keep the session encrypted (a Linux runner with no keyring cannot).
async function canKeepSession(): Promise<boolean> {
  return app!.evaluate(
    ({ safeStorage }) =>
      safeStorage.isEncryptionAvailable() &&
      !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
  )
}

// The browser sends the person back to the app with a link; a second launch hands it to the first.
async function comeBackFromBrowser(link: string): Promise<void> {
  await app!.evaluate(({ app: electronApp }, url) => {
    electronApp.emit('second-instance', {}, ['vyro', url])
  }, link)
}

test('opens on the sign-in page, with no side bar, and a wrong password does not get in', async () => {
  const page = await launch()

  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
  await expect(bar(page)).toHaveCount(0)

  await fillSignIn(page, TEST_USER.email, 'not-the-password')
  await expect(page.getByRole('alert')).toHaveText('El correo o la contraseña no son correctos.')
  await expect(bar(page)).toHaveCount(0)
})

test('signs in, shows who is signed in and signs out', async () => {
  const page = await launch()
  await fillSignIn(page, TEST_USER.email, TEST_USER.password)

  await expect(bar(page).getByRole('button', { name: 'Inicio' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(bar(page).getByText(TEST_USER.email)).toBeVisible()

  await bar(page).getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
  await expect(bar(page)).toHaveCount(0)
})

test('creates an account: asks for the code of the email before letting in', async () => {
  const page = await launch()
  const email = freshEmail()

  await page.getByRole('button', { name: '¿No tienes cuenta? Créala' }).click()
  await page.getByLabel('Correo', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill('a-long-enough-pass')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByRole('heading', { name: 'Confirma tu correo' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(email)
  await expect(bar(page)).toHaveCount(0)

  await page.getByLabel('Código del correo').fill('000000')
  await page.getByRole('button', { name: 'Confirmar correo' }).click()
  await expect(page.getByRole('alert')).toHaveText('El código no es válido o ya caducó. Pide otro.')

  await page.getByLabel('Código del correo').fill(EMAIL_CODE)
  await page.getByRole('button', { name: 'Confirmar correo' }).click()
  await expect(bar(page).getByText(email)).toBeVisible()
})

test('refuses a short password and a person who asked for too many emails', async () => {
  const page = await launch()
  await page.getByRole('button', { name: '¿No tienes cuenta? Créala' }).click()

  await page.getByLabel('Correo', { exact: true }).fill(freshEmail())
  await page.getByLabel('Contraseña', { exact: true }).fill('short')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('alert')).toContainText('mínimo 8 caracteres')

  await page.getByLabel('Correo', { exact: true }).fill(RATE_LIMITED_EMAIL)
  await page.getByLabel('Contraseña', { exact: true }).fill('a-long-enough-pass')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('alert')).toContainText('Demasiados intentos')
})

test('an email that was never confirmed is sent to the code instead of in', async () => {
  const page = await launch()
  const email = freshEmail()

  await page.getByRole('button', { name: '¿No tienes cuenta? Créala' }).click()
  await page.getByLabel('Correo', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill('a-long-enough-pass')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Confirma tu correo' })).toBeVisible()

  // Leaves, and tries to sign in without confirming.
  await page.getByRole('button', { name: 'Volver' }).click()
  await fillSignIn(page, email, 'a-long-enough-pass')
  await expect(page.getByRole('heading', { name: 'Confirma tu correo' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('confirma tu correo')
})

test('recovers a password with the code of the email, and the old one stops working', async () => {
  const page = await launch()
  const email = freshEmail()

  // An account to recover.
  await page.getByRole('button', { name: '¿No tienes cuenta? Créala' }).click()
  await page.getByLabel('Correo', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill('the-old-password')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Código del correo').fill(EMAIL_CODE)
  await page.getByRole('button', { name: 'Confirmar correo' }).click()
  await bar(page).getByRole('button', { name: 'Cerrar sesión' }).click()

  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
  await page.getByLabel('Correo', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Enviar código' }).click()
  await expect(page.getByRole('heading', { name: 'Elige una contraseña nueva' })).toBeVisible()

  // A weak password is refused and the page stays where it is.
  await page.getByLabel('Código del correo').fill(RESET_CODE)
  await page.getByLabel('Contraseña nueva').fill('password')
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
  await expect(page.getByRole('alert')).toContainText('no es lo bastante segura')

  await page.getByLabel('Contraseña nueva').fill('the-new-password')
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
  await expect(bar(page).getByText(email)).toBeVisible()

  await bar(page).getByRole('button', { name: 'Cerrar sesión' }).click()
  await fillSignIn(page, email, 'the-old-password')
  await expect(page.getByRole('alert')).toContainText('no son correctos')
})

test('asking for a password reset says the same for an address with no account', async () => {
  const page = await launch()
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
  await page.getByLabel('Correo', { exact: true }).fill('nobody@vyro.test')
  await page.getByRole('button', { name: 'Enviar código' }).click()

  await expect(page.getByRole('heading', { name: 'Elige una contraseña nueva' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Si nobody@vyro.test tiene una cuenta')
})

test('signs in with Google when the browser comes back, and refuses a return that did not start here', async () => {
  const page = await launch()

  // A link that arrives without the person having started in the app: there is no secret to match.
  await comeBackFromBrowser(`vyro://auth/callback?code=${GOOGLE_CODE_PREFIX}1234abcd`)
  await expect(page.getByRole('alert')).toContainText('El código no es válido')
  await expect(bar(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Continuar con Google' }).click()
  await expect(page.getByRole('status')).toContainText('Termina en el navegador')

  // A return with an error from the provider.
  await comeBackFromBrowser('vyro://auth/callback?error=access_denied')
  await expect(page.getByRole('alert')).toContainText('El código no es válido')

  await page.getByRole('button', { name: 'Continuar con Google' }).click()
  await comeBackFromBrowser(`vyro://auth/callback?code=${GOOGLE_CODE_PREFIX}1234abcd`)
  await expect(bar(page).getByText('ana.google@vyro.test')).toBeVisible()
})

test('ignores a link that is not the sign-in link', async () => {
  const page = await launch()
  await comeBackFromBrowser('vyro://somewhere/else?code=good-1234abcd')
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a session survives a restart, and a signed-out app opens on the sign-in page', async () => {
  const first = await launch()
  test.skip(!(await canKeepSession()), 'this system cannot keep the session encrypted')
  await fillSignIn(first, TEST_USER.email, TEST_USER.password)
  await expect(bar(first)).toBeVisible()
  await app!.close()

  const second = await launch()
  await expect(bar(second).getByText(TEST_USER.email)).toBeVisible()
  await bar(second).getByRole('button', { name: 'Cerrar sesión' }).click()
  await app!.close()

  const third = await launch()
  await expect(third.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
})

test('opens offline with a stored session that has already expired', async () => {
  const first = await launch()
  test.skip(!(await canKeepSession()), 'this system cannot keep the session encrypted')
  await fillSignIn(first, SHORT_LIVED_EMAIL, TEST_USER.password)
  await expect(bar(first)).toBeVisible()
  // The session lasts one second: when the app is closed it has expired.
  await first.waitForTimeout(2500)
  await app!.close()

  // Nothing answers at this address, as when the computer has no connection.
  const second = await launch({ VYRO_E2E_SUPABASE_URL: 'http://127.0.0.1:1' })
  await expect(bar(second).getByText(SHORT_LIVED_EMAIL)).toBeVisible({ timeout: 30_000 })
})
