import { describe, expect, it } from 'vitest'
import { mayOpenInBrowser } from './browser'

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
