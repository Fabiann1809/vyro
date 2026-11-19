import { describe, expect, it } from 'vitest'
import { findCallbackUrl, parseAuthCallback } from './callback'

describe('parseAuthCallback', () => {
  it('reads the code of a sign-in link', () => {
    expect(parseAuthCallback('vyro://auth/callback?code=abcd1234-efgh')).toEqual({
      kind: 'code',
      code: 'abcd1234-efgh'
    })
  })

  it('treats an error from the provider as a failed attempt', () => {
    expect(parseAuthCallback('vyro://auth/callback?error=access_denied')).toEqual({
      kind: 'failed'
    })
    expect(parseAuthCallback('vyro://auth/callback?error_code=otp_expired&code=abcd1234')).toEqual({
      kind: 'failed'
    })
  })

  it('treats a missing or odd code as a failed attempt', () => {
    for (const link of [
      'vyro://auth/callback',
      'vyro://auth/callback?code=',
      'vyro://auth/callback?code=short',
      'vyro://auth/callback?code=has%20spaces%20in%20it',
      `vyro://auth/callback?code=${'a'.repeat(513)}`
    ]) {
      expect(parseAuthCallback(link)).toEqual({ kind: 'failed' })
    }
  })

  it('ignores every other address', () => {
    for (const link of [
      'vyro://other/callback?code=abcd1234',
      'vyro://auth/elsewhere?code=abcd1234',
      'https://auth/callback?code=abcd1234',
      'vyro:auth/callback?code=abcd1234',
      'not a link',
      ''
    ]) {
      expect(parseAuthCallback(link)).toBeNull()
    }
  })
})

describe('findCallbackUrl', () => {
  it('finds the link among the arguments of a launch', () => {
    expect(findCallbackUrl(['vyro.exe', '--flag', 'vyro://auth/callback?code=abcd1234'])).toBe(
      'vyro://auth/callback?code=abcd1234'
    )
    expect(findCallbackUrl(['vyro.exe', '--flag'])).toBeNull()
  })
})
