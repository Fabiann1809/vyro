import { describe, expect, it } from 'vitest'
import { classifyError, LlmError } from './errors'

class NamedError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
  }
}

describe('classifyError', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate-limit'],
    [408, 'timeout'],
    [500, 'server'],
    [529, 'server'],
    [400, 'request'],
    [404, 'request']
  ])('classifies HTTP %i as %s', (status, kind) => {
    expect(classifyError(new NamedError('x', status))).toMatchObject({ kind, status })
  })

  it('recognises a timeout and an abort by the name of the error class', () => {
    class APIConnectionTimeoutError extends Error {}
    class AbortError extends Error {}

    expect(classifyError(new APIConnectionTimeoutError()).kind).toBe('timeout')
    expect(classifyError(new AbortError()).kind).toBe('cancelled')
  })

  it('treats a failed fetch and network error codes as network problems', () => {
    expect(classifyError(new TypeError('fetch failed')).kind).toBe('network')
    expect(classifyError(Object.assign(new Error('x'), { code: 'ENOTFOUND' })).kind).toBe('network')
  })

  it('falls back to unknown', () => {
    expect(classifyError(new Error('boom')).kind).toBe('unknown')
    expect(classifyError('a string').kind).toBe('unknown')
    expect(classifyError(null).kind).toBe('unknown')
  })

  it('keeps an LlmError as it is', () => {
    const original = new LlmError('refused')

    expect(classifyError(original)).toBe(original)
  })

  it('never carries the message of the original error', () => {
    const error = new NamedError('request with key sk-secret-123 failed', 401)

    expect(classifyError(error).message).not.toContain('sk-secret-123')
  })

  it('marks as retryable only what can pass by itself', () => {
    expect(new LlmError('rate-limit').retryable).toBe(true)
    expect(new LlmError('server').retryable).toBe(true)
    expect(new LlmError('auth').retryable).toBe(false)
    expect(new LlmError('invalid-response').retryable).toBe(false)
  })
})
