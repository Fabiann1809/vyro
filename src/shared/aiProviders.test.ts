import { describe, expect, it } from 'vitest'
import { AI_PROVIDERS, AI_PROVIDER_IDS, isSafeAiBaseUrl } from './aiProviders'
import { settingsPatchSchema } from './settings'

describe('isSafeAiBaseUrl', () => {
  it.each([
    'https://api.groq.com/openai/v1',
    'https://example.com',
    'http://localhost:11434/v1',
    'http://127.0.0.1:8080',
    'http://[::1]:11434/v1'
  ])('accepts %s', (url) => {
    expect(isSafeAiBaseUrl(url)).toBe(true)
  })

  it.each([
    ['plain HTTP to another computer', 'http://example.com/v1'],
    ['plain HTTP to a LAN address', 'http://192.168.1.20:11434/v1'],
    ['a name that only starts like localhost', 'http://localhost.evil.com/v1'],
    ['a user name and password in the address', 'https://user:pass@example.com'],
    ['another protocol', 'ftp://example.com'],
    ['something that is not an address', 'not a url'],
    ['an empty string', '']
  ])('rejects %s', (_name, url) => {
    expect(isSafeAiBaseUrl(url)).toBe(false)
  })
})

describe('provider presets', () => {
  it('has a safe address for every preset that has one', () => {
    for (const id of AI_PROVIDER_IDS) {
      const { baseUrl } = AI_PROVIDERS[id]
      if (baseUrl) expect(isSafeAiBaseUrl(baseUrl), id).toBe(true)
    }
  })

  it('does not ask for a key only where the provider runs on this computer', () => {
    expect(AI_PROVIDER_IDS.filter((id) => !AI_PROVIDERS[id].requiresKey)).toEqual(['ollama'])
  })
})

describe('AI provider settings', () => {
  it('accepts a valid provider, model and address', () => {
    expect(
      settingsPatchSchema.safeParse({
        aiProvider: 'custom',
        aiModel: 'my-model',
        aiBaseUrl: 'https://llm.example.com/v1'
      }).success
    ).toBe(true)
  })

  it.each([
    ['an unknown provider', { aiProvider: 'skynet' }],
    ['an empty model', { aiModel: '' }],
    ['an address over plain HTTP to another computer', { aiBaseUrl: 'http://example.com/v1' }],
    ['an address that is not one', { aiBaseUrl: 'hello' }]
  ])('rejects %s', (_name, patch) => {
    expect(settingsPatchSchema.safeParse(patch).success).toBe(false)
  })

  it('lets the model and the address go back to "not chosen"', () => {
    expect(settingsPatchSchema.safeParse({ aiModel: null, aiBaseUrl: null }).success).toBe(true)
  })
})
