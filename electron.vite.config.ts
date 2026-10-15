import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { buildCsp } from './src/shared/csp'

const shared = resolve('src/shared')

// Injects the Content-Security-Policy into index.html: strict on build, relaxed only on dev server.
function cspPlugin(): Plugin {
  let isDev = false
  return {
    name: 'vyro-csp',
    configResolved(config) {
      isDev = config.command === 'serve'
    },
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${buildCsp(isDev)}" />`
      return html.replace('<!--app-csp-->', meta)
    }
  }
}

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared } }
  },
  preload: {
    resolve: { alias: { '@shared': shared } }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': shared
      }
    },
    plugins: [react(), tailwindcss(), cspPlugin()]
  }
})
