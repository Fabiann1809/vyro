// Content-Security-Policy for the renderer. The strict variant is what ships;
// the dev variant only adds what Vite's hot reload needs.
export function buildCsp(isDev: boolean): string {
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'wasm-unsafe-eval'"
    : "'self' 'wasm-unsafe-eval'"
  const connectSrc = isDev ? "'self' ws://localhost:* http://localhost:*" : "'self'"

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ')
}
