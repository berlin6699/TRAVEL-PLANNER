/// <reference types="vite/client" />

declare const __APP_VERSION__: string

type DesktopDataLocation = {
  appName: string
  dataPath: string
  indexedDbPath: string
  platform: string
  isPackaged: boolean
}

type DesktopOpenResult = {
  success: boolean
  message: string
}

type DesktopNotificationPayload = {
  id: number
  title: string
  body: string
  at: string
}

interface Window {
  travelPlannerDesktop?: {
    getDataLocation: () => Promise<DesktopDataLocation>
    openDataLocation: () => Promise<DesktopOpenResult>
    scheduleNotification: (payload: DesktopNotificationPayload) => Promise<{ scheduled: boolean }>
    cancelNotification: (id: number) => Promise<void>
    cancelAllNotifications: () => Promise<void>
  }
}
