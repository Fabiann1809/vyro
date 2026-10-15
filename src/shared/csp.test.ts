import { describe, expect, it } from 'vitest'
import { buildCsp } from '@shared/csp'

describe('buildCsp', () => {
  it('does not allow inline scripts or eval in production', () => {
    const csp = buildCsp(false)
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'")
    expect(csp).not.toContain("'unsafe-inline' 'wasm")
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('blocks network access beyond the app itself in production', () => {
    expect(buildCsp(false)).toContain("connect-src 'self'")
    expect(buildCsp(false)).not.toContain('ws:')
  })

  it('allows hot reload only in development', () => {
    expect(buildCsp(true)).toContain('ws://localhost:*')
    expect(buildCsp(true)).toContain("'unsafe-inline'")
  })

  it('always forbids plugins, base tag changes and form posts', () => {
    for (const isDev of [true, false]) {
      const csp = buildCsp(isDev)
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("base-uri 'none'")
      expect(csp).toContain("form-action 'none'")
    }
  })
})
