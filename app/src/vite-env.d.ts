/// <reference types="vite/client" />

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

interface Window {
  travelPlannerDesktop?: {
    getDataLocation: () => Promise<DesktopDataLocation>
    openDataLocation: () => Promise<DesktopOpenResult>
  }
}
