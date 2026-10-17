/* eslint-disable @typescript-eslint/no-require-imports */
// A bare Electron app for a model-loading test: it opens the page given in MODEL_PAGE_URL and nothing else.
const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const window = new BrowserWindow({ show: false })
  void window.loadURL(process.env.MODEL_PAGE_URL)
})
