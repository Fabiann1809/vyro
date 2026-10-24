import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

// The frame of the app: the side bar takes the person to each place, folds into icons, and keeps
// being folded while they move around.

let app: ElectronApplication | undefined
let userData: string

test.beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), 'vyro-shell-'))
})

test.afterEach(async () => {
  await app?.close()
  app = undefined
  rmSync(userData, { recursive: true, force: true })
})

test('the side bar goes to each place, folds and stays folded', async () => {
  app = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`, ...(process.env['CI'] ? ['--no-sandbox'] : [])]
  })
  const page = await app.firstWindow()
  const bar = page.getByRole('navigation', { name: 'Navegación principal' })

  await expect(bar.getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')

  await bar.getByRole('button', { name: 'Biblioteca' }).click()
  await expect(bar.getByRole('button', { name: 'Biblioteca' })).toHaveAttribute(
    'aria-current',
    'page'
  )

  await bar.getByRole('button', { name: 'Colapsar la barra' }).click()
  await expect(bar.getByRole('button', { name: 'Expandir la barra' })).toHaveAttribute(
    'aria-expanded',
    'false'
  )
  // Folded, the names are gone from the page but the buttons still have them.
  await expect(bar.getByText('te mira · te escucha')).toHaveCount(0)

  await bar.getByRole('button', { name: 'Ajustes' }).click()
  await expect(bar.getByRole('button', { name: 'Ajustes' })).toHaveAttribute('aria-current', 'page')
  await expect(bar.getByRole('button', { name: 'Expandir la barra' })).toBeVisible()

  await bar.getByRole('button', { name: 'Expandir la barra' }).click()
  await expect(bar.getByText('te mira · te escucha')).toBeVisible()
})
