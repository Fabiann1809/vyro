import { startFakeAuth } from './fakeAuth'

// One fake account service for the whole run. The workers inherit this variable, and the app reads
// it (only when it runs from source) instead of the address of the real service.
export default async function globalSetup(): Promise<() => Promise<void>> {
  const auth = await startFakeAuth()
  process.env['VYRO_E2E_SUPABASE_URL'] = auth.url
  return auth.close
}
