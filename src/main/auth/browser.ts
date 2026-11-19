const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

// Whether an address is on the same server as the account service: the page of the sign-in with
// Google is built from its address, so any other server means something went wrong.
export function isOnServer(address: string, serverUrl: string): boolean {
  try {
    return new URL(address).origin === new URL(serverUrl).origin
  } catch {
    return false
  }
}

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
