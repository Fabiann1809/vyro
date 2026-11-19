import { describe, expect, it } from 'vitest'
import { readAuthConfig } from './config'

const URL = 'https://abc.supabase.co'
const KEY = 'sb_publishable_abc'

describe('readAuthConfig', () => {
  it('reads the address and the publishable key', () => {
    expect(
      readAuthConfig({ MAIN_VITE_SUPABASE_URL: `${URL}/`, MAIN_VITE_SUPABASE_PUBLISHABLE_KEY: KEY })
    ).toEqual({ url: URL, publishableKey: KEY })
  })

  it('is null when something is missing or odd', () => {
    expect(readAuthConfig({})).toBeNull()
    expect(readAuthConfig({ MAIN_VITE_SUPABASE_URL: URL })).toBeNull()
    expect(readAuthConfig({ MAIN_VITE_SUPABASE_PUBLISHABLE_KEY: KEY })).toBeNull()
    expect(
      readAuthConfig({
        MAIN_VITE_SUPABASE_URL: 'http://abc.supabase.co',
        MAIN_VITE_SUPABASE_PUBLISHABLE_KEY: KEY
      })
    ).toBeNull()
    expect(
      readAuthConfig({
        MAIN_VITE_SUPABASE_URL: 'not a url',
        MAIN_VITE_SUPABASE_PUBLISHABLE_KEY: KEY
      })
    ).toBeNull()
  })

  it('accepts a plain address on this computer only under test', () => {
    const env = {
      MAIN_VITE_SUPABASE_URL: 'http://127.0.0.1:5000',
      MAIN_VITE_SUPABASE_PUBLISHABLE_KEY: KEY
    }
    expect(readAuthConfig(env)).toBeNull()
    expect(readAuthConfig(env, { allowLoopbackHttp: true })).toEqual({
      url: 'http://127.0.0.1:5000',
      publishableKey: KEY
    })
  })

  it('refuses a secret key, which must never ship in the app', () => {
    expect(
      readAuthConfig({
        MAIN_VITE_SUPABASE_URL: URL,
        MAIN_VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc'
      })
    ).toBeNull()
  })
})
