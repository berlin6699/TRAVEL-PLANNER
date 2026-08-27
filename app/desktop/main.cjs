const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const APP_NAME = '旅途 Travel Planner'
const DATA_DIR_NAME = 'Travel Planner'
const isDev = !app.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL)
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:'])

app.setName(APP_NAME)
app.setPath('userData', path.join(app.getPath('appData'), DATA_DIR_NAME))

function getDataLocation() {
  const dataPath = app.getPath('userData')
  return {
    appName: APP_NAME,
    dataPath,
    indexedDbPath: path.join(dataPath, 'IndexedDB'),
    platform: process.platform,
    isPackaged: app.isPackaged,
  }
}

function ensureDataDirectory() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
}

function openExternalSafely(url) {
  try {
    const parsed = new URL(url)
    if (EXTERNAL_PROTOCOLS.has(parsed.protocol)) void shell.openExternal(parsed.toString())
  } catch {
    // Ignore malformed or unsupported links from imported data.
  }
}

function createWindow() {
  ensureDataDirectory()

  const win = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#f7f5ef',
    title: APP_NAME,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:')) return { action: 'allow' }
    openExternalSafely(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL()
    try {
      const nextUrl = new URL(url)
      const currentUrl = new URL(current)
      const sameDocument = currentUrl.protocol === 'file:'
        ? nextUrl.protocol === 'file:' && nextUrl.pathname === currentUrl.pathname
        : nextUrl.origin === currentUrl.origin
      if (sameDocument) return
    } catch {
      // Invalid navigations are blocked below.
    }
    event.preventDefault()
    openExternalSafely(url)
  })

  if (isDev) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

ipcMain.handle('desktop:get-data-location', () => getDataLocation())
ipcMain.handle('desktop:open-data-location', async () => {
  ensureDataDirectory()
  const errorMessage = await shell.openPath(app.getPath('userData'))
  return { success: !errorMessage, message: errorMessage || '' }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
