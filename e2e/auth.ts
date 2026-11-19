import type { Page } from '@playwright/test'
import { TEST_USER } from './fakeAuth'

// In either language: the app can come back in English after a restart, sign-in page included.
const NAV = /Navegación principal|Main navigation/
const ENTER = /^(Entrar|Sign in)$/
const KEEP = /^(Conservar en mi cuenta|Keep it in my account)$/
const EMAIL = /^(Correo|Email)$/
const PASSWORD = /^(Contraseña|Password)$/

// The app is closed to anyone who has not signed in, so a test that wants to use it signs in first.
// When a session came back from the last run the app is already open and nothing is typed. A
// computer that has data from before the account asks what to do with it: the tests keep it.
//
// A session only comes back where the system can keep it encrypted: a Linux runner with no keyring
// cannot, so after a restart the sign-in page is there and has to be filled in again.
export async function signInAs(page: Page, email: string, password: string): Promise<void> {
  const nav = page.getByRole('navigation', { name: NAV })
  const enter = page.getByRole('button', { name: ENTER })
  const keep = page.getByRole('button', { name: KEEP })

  await nav.or(enter).or(keep).first().waitFor()
  if (await enter.isVisible()) {
    await page.getByLabel(EMAIL).fill(email)
    await page.getByLabel(PASSWORD).fill(password)
    await enter.click()
    await nav.or(keep).first().waitFor()
  }
  if (await keep.isVisible()) await keep.click()
  await nav.waitFor()
}

export const signIn = (page: Page): Promise<void> =>
  signInAs(page, TEST_USER.email, TEST_USER.password)
