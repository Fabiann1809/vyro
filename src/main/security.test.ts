import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ session: {}, shell: {} }))

import { isExternalHttpsUrl } from './security'

describe('isExternalHttpsUrl', () => {
  it('accepts https links', () => {
    expect(isExternalHttpsUrl('https://github.com/Fabiann1809/vyro')).toBe(true)
  })

  it.each(['http://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url'])(
    'rejects %s',
    (url) => {
      expect(isExternalHttpsUrl(url)).toBe(false)
    }
  )
})
