import { describe, expect, it } from 'vitest'
import { isOnServer, mayOpenInBrowser } from './browser'

describe('mayOpenInBrowser', () => {
  it('opens secure addresses', () => {
    expect(mayOpenInBrowser('https://accounts.google.com/o/oauth2/v2/auth?x=1')).toBe(true)
  })

  it('refuses everything else, whatever the address', () => {
    for (const address of [
      'http://accounts.google.com',
      'http://127.0.0.1:8080/start',
      'file:///C:/Windows/System32/calc.exe',
      'vyro://auth/callback',
      'javascript:alert(1)',
      'not an address',
      ''
    ]) {
      expect(mayOpenInBrowser(address)).toBe(false)
    }
  })

  it('opens a plain address on this computer only when told it is under test', () => {
    expect(mayOpenInBrowser('http://127.0.0.1:8080/start', true)).toBe(true)
    expect(mayOpenInBrowser('http://localhost:8080/start', true)).toBe(true)
    expect(mayOpenInBrowser('http://evil.example.com/start', true)).toBe(false)
    expect(mayOpenInBrowser('http://127.0.0.1.evil.example.com/start', true)).toBe(false)
  })
})

describe('isOnServer', () => {
  const server = 'https://abc.supabase.co'

  it('accepts the pages of the account service', () => {
    expect(isOnServer('https://abc.supabase.co/auth/v1/authorize?provider=google', server)).toBe(
      true
    )
  })

  it('refuses any other server, however alike it looks', () => {
    for (const address of [
      'https://evil.example.com/auth/v1/authorize',
      'https://abc.supabase.co.evil.example.com/authorize',
      'http://abc.supabase.co/authorize',
      'https://abc.supabase.co:8443/authorize',
      'not an address'
    ]) {
      expect(isOnServer(address, server)).toBe(false)
    }
  })
})
