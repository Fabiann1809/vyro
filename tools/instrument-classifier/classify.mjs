// Classifies short synthetic clips with the bundled YAMNet model, in a headless Chromium, to check
// that the model runs offline with the MediaPipe audio task and which classes it answers.
// Usage: node tools/instrument-classifier/classify.mjs [--json]
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const audioDir = join(root, 'node_modules/@mediapipe/tasks-audio')
const files = {
  '/': join(root, 'tools/instrument-classifier/page.html'),
  '/model/yamnet.tflite': join(root, 'src/renderer/assets/models/yamnet.tflite')
}
const types = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm'
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://x').pathname
  const file = files[path] ?? (path.startsWith('/audio/') ? join(audioDir, path.slice(7)) : null)
  try {
    const body = await readFile(file)
    const ext = file.slice(file.lastIndexOf('.'))
    response.writeHead(200, { 'content-type': types[ext] ?? 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage()
page.on('pageerror', (error) => console.error('page error:', error.message))
await page.goto(`http://127.0.0.1:${server.address().port}/`)
const result = await page.evaluate(() => window.run())
if (process.argv.includes('--json')) {
  // The raw answers, to keep as test fixtures for the code that reads them.
  console.log(JSON.stringify(result))
} else {
  for (const [name, windows] of Object.entries(result)) {
    console.log(`
${name}`)
    windows.slice(0, 2).forEach((top) =>
      console.log(
        '  ',
        top
          .slice(0, 3)
          .map((c) => `${c.name} ${c.score.toFixed(2)}`)
          .join(' | ')
      )
    )
  }
}
await browser.close()
server.close()
