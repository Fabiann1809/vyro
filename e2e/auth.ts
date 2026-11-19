import type { Page } from '@playwright/test'
import { TEST_USER } from './fakeAuth'

// The app is closed to anyone who has not signed in, so a test that wants to use it signs in first.
// When a session came back from the last run the app is already open and nothing is typed.
export async function signIn(page: Page): Promise<void> {
  // In either language: the app can come back in English after a restart.
  const nav = page.getByRole('navigation', { name: /Navegación principal|Main navigation/ })
  const enter = page.getByRole('button', { name: /^(Entrar|Sign in)$/ })
  await nav.or(enter).first().waitFor()
  if (!(await enter.isVisible())) return

  await page.getByLabel('Correo', { exact: true }).fill(TEST_USER.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(TEST_USER.password)
  await enter.click()
  await nav.waitFor()
}
