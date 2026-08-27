const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const APP_NAME = '旅途 Travel Planner'
const DATA_DIR_NAME = 'Travel Planner'
const isDev = !app.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL)
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:'])
const MAX_TIMER_DELAY = 2_147_000_000
const notificationTimers = new Map()
const activeNotifications = new Map()
let mainWindow = null

app.setName(APP_NAME)
app.setPath('userData', path.join(app.getPath('appData'), DATA_DIR_NAME))
if (process.platform === 'win32') app.setAppUserModelId('com.berlin6699.travelplanner')

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
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
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

function cancelDesktopNotification(id) {
  const timer = notificationTimers.get(id)
  if (timer) clearTimeout(timer)
  notificationTimers.delete(id)
  const active = activeNotifications.get(id)
  if (active) active.close()
  activeNotifications.delete(id)
}

function showDesktopNotification(payload) {
  notificationTimers.delete(payload.id)
  if (!Notification.isSupported()) return
  const notification = new Notification({
    id: `itinerary-${payload.id}`,
    groupId: 'itinerary-reminders',
    groupTitle: '行程提醒',
    title: payload.title,
    body: payload.body,
  })
  activeNotifications.set(payload.id, notification)
  const release = () => activeNotifications.delete(payload.id)
  notification.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow()
    mainWindow?.show()
    mainWindow?.focus()
    release()
  })
  notification.on('close', release)
  notification.on('failed', release)
  notification.show()
}

function armDesktopNotification(payload) {
  cancelDesktopNotification(payload.id)
  const arm = () => {
    const remaining = Date.parse(payload.at) - Date.now()
    if (remaining <= 0) {
      showDesktopNotification(payload)
      return
    }
    notificationTimers.set(payload.id, setTimeout(arm, Math.min(remaining, MAX_TIMER_DELAY)))
  }
  arm()
}

function validNotificationPayload(value) {
  if (!value || !Number.isInteger(value.id) || value.id <= 0 || value.id > 2_147_483_647) return null
  const timestamp = Date.parse(value.at)
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return null
  const title = String(value.title || '').trim().slice(0, 160)
  const body = String(value.body || '').trim().slice(0, 300)
  if (!title || !body) return null
  return { id: value.id, title, body, at: new Date(timestamp).toISOString() }
}

ipcMain.handle('desktop:get-data-location', () => getDataLocation())
ipcMain.handle('desktop:open-data-location', async () => {
  ensureDataDirectory()
  const errorMessage = await shell.openPath(app.getPath('userData'))
  return { success: !errorMessage, message: errorMessage || '' }
})
ipcMain.handle('desktop:schedule-notification', (_event, value) => {
  const payload = validNotificationPayload(value)
  if (!payload) return { scheduled: false }
  armDesktopNotification(payload)
  return { scheduled: true }
})
ipcMain.handle('desktop:cancel-notification', (_event, id) => {
  if (Number.isInteger(id)) cancelDesktopNotification(id)
})
ipcMain.handle('desktop:cancel-all-notifications', () => {
  for (const id of [...notificationTimers.keys()]) cancelDesktopNotification(id)
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
