import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

// The guitar detector and the MediaPipe runtime are the files the app bundles. This loads them in
// Electron's own Chromium with every address but this computer unreachable, which is what "works
// without internet" means.

const VISION = resolve('node_modules/@mediapipe/tasks-vision')
const FILES: Record<string, { path: string; type: string }> = {
  '/vision_bundle.mjs': { path: `${VISION}/vision_bundle.mjs`, type: 'text/javascript' },
  '/wasm/vision_wasm_internal.js': {
    path: `${VISION}/wasm/vision_wasm_internal.js`,
    type: 'text/javascript'
  },
  '/wasm/vision_wasm_internal.wasm': {
    path: `${VISION}/wasm/vision_wasm_internal.wasm`,
    type: 'application/wasm'
  },
  '/guitar_detector.tflite': {
    path: resolve('src/renderer/assets/models/guitar_detector.tflite'),
    type: 'application/octet-stream'
  }
}

const PAGE = `<!doctype html><title>loading</title><script type="module">
import { ObjectDetector } from '/vision_bundle.mjs'
try {
  const detector = await ObjectDetector.createFromOptions(
    { wasmLoaderPath: '/wasm/vision_wasm_internal.js', wasmBinaryPath: '/wasm/vision_wasm_internal.wasm' },
    { baseOptions: { modelAssetPath: '/guitar_detector.tflite', delegate: 'CPU' }, runningMode: 'IMAGE', scoreThreshold: 0.4, maxResults: 1 }
  )
  // The model is in memory: what follows only needs a graphics context, which a machine without
  // a screen (a CI runner) may not have.
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    // An empty picture has no guitar: what matters is that the model ran.
    document.title = 'ready:' + detector.detect(canvas).detections.length
  } catch (error) {
    document.title = 'loaded:' + String(error)
  }
} catch (error) {
  document.title = 'error:' + String(error)
}
</script>`

test('the guitar detector loads and runs with no network but this computer', async () => {
  const requested: string[] = []
  const server: Server = createServer((request, response) => {
    const url = request.url ?? '/'
    requested.push(url)
    const file = FILES[url]
    if (!file) {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(PAGE)
      return
    }
    response.writeHead(200, { 'content-type': file.type })
    response.end(readFileSync(file.path))
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  const app = await electron.launch({
    args: [
      resolve('e2e/modelLoad/main.cjs'),
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      ...(process.env['CI'] ? ['--no-sandbox'] : [])
    ],
    env: { ...process.env, MODEL_PAGE_URL: `http://127.0.0.1:${port}/` } as Record<string, string>
  })
  try {
    const page = await app.firstWindow()
    await expect.poll(() => page.title(), { timeout: 30_000 }).toMatch(/^(ready|loaded|error)/)
    // Loaded is what this is about; running it also needs WebGL, which a runner may not have.
    const title = await page.title()
    expect(title).toMatch(/^(ready:0|loaded:.*activeTexture)/)
    expect(requested).toContain('/guitar_detector.tflite')
  } finally {
    await app.close()
    await new Promise<void>((done) => server.close(() => done()))
  }
})
