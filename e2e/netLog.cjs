/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
// Loaded into the main process of the app under test (electron -r). It writes down every
// request that Node code makes (fetch, http, https) to the file named by VYRO_NET_LOG, so a test can
// see everything that leaves the app, not only what reaches a server it set up itself.
const fs = require('node:fs')
const http = require('node:http')
const https = require('node:https')

const file = process.env.VYRO_NET_LOG
if (file) {
  fs.appendFileSync(file, JSON.stringify({ via: 'loaded', url: '', body: null }) + '\n')
  const record = (entry) => fs.appendFileSync(file, JSON.stringify(entry) + '\n')

  const realFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
    record({
      via: 'fetch',
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : null
    })
    return realFetch(input, init)
  }

  for (const [name, module] of [
    ['http', http],
    ['https', https]
  ]) {
    const realRequest = module.request
    module.request = function (...args) {
      const target = args[0]
      const url =
        typeof target === 'string' || target instanceof URL
          ? String(target)
          : `${name}://${target.hostname ?? target.host ?? 'unknown'}${target.path ?? ''}`
      record({ via: name, url, method: 'unknown', body: null })
      return realRequest.apply(this, args)
    }
  }
}
