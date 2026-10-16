import { defineConfig } from '@playwright/test'

// One smoke test that opens the built app (run `pnpm build` first) and walks through its screens.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'list'
})
