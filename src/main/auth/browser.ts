const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

// Whether an address may be opened in the system browser for a sign-in: a secure one, and, only
// when the app is under test, a plain one on this same computer (the fake server of the tests).
export function mayOpenInBrowser(address: string, allowLoopbackHttp = false): boolean {
  try {
    const url = new URL(address)
    if (url.protocol === 'https:') return true
    return allowLoopbackHttp && url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}
