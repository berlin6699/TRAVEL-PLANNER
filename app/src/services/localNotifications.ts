import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { ItineraryItem } from '../types'

const CHANNEL_ID = 'itinerary-reminders'

function desktopBridge() {
  return typeof window !== 'undefined' ? window.travelPlannerDesktop : undefined
}

export function itineraryStartAt(item: Pick<ItineraryItem, 'date' | 'start_time'>): Date | null {
  const time = item.start_time.slice(0, 5)
  const value = new Date(`${item.date}T${time}:00`)
  return Number.isNaN(value.getTime()) ? null : value
}

export function itineraryReminderAt(item: Pick<ItineraryItem, 'date' | 'start_time' | 'reminder_minutes'>): Date | null {
  if (item.reminder_minutes == null || !Number.isInteger(item.reminder_minutes) || item.reminder_minutes < 0 || item.reminder_minutes > 10080) return null
  const start = itineraryStartAt(item)
  if (!start) return null
  return new Date(start.getTime() - item.reminder_minutes * 60_000)
}

function reminderBody(item: Pick<ItineraryItem, 'date' | 'start_time' | 'location'>) {
  const time = item.start_time.slice(0, 5)
  return `${item.date} ${time}${item.location ? ` · ${item.location}` : ''}`
}

async function ensureAndroidChannel() {
  if (Capacitor.getPlatform() !== 'android') return
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: '行程提醒',
    description: '在日程开始前提醒你',
    importance: 4,
    visibility: 1,
    vibration: true,
  })
}

async function nativePermission(request: boolean) {
  let permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted' && request) permission = await LocalNotifications.requestPermissions()
  return permission.display === 'granted'
}

export async function requestItineraryReminderPermission(item: Pick<ItineraryItem, 'date' | 'start_time' | 'reminder_minutes'>) {
  const start = itineraryStartAt(item)
  const at = itineraryReminderAt(item)
  if (item.reminder_minutes != null && start && start.getTime() > Date.now() && at && at.getTime() <= Date.now()) {
    throw new Error('所选提醒时间已经过去，请选择更短的提前时间。')
  }
  if (!at || at.getTime() <= Date.now() || !Capacitor.isNativePlatform()) return
  if (!await nativePermission(true)) throw new Error('未获得系统通知权限，请在设备设置中允许“旅途”发送通知。')
}

export async function cancelItineraryReminder(id: number) {
  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.cancel({ notifications: [{ id }] })
    return
  }
  await desktopBridge()?.cancelNotification(id)
}

export async function scheduleItineraryReminder(item: ItineraryItem) {
  const at = itineraryReminderAt(item)
  await cancelItineraryReminder(item.id)
  if (!at || at.getTime() <= Date.now()) return false

  if (Capacitor.isNativePlatform()) {
    if (!await nativePermission(false)) return false
    await ensureAndroidChannel()
    await LocalNotifications.schedule({ notifications: [{
      id: item.id,
      title: `行程即将开始：${item.title}`,
      body: reminderBody(item),
      schedule: { at, allowWhileIdle: true },
      channelId: CHANNEL_ID,
      foreground: true,
      isExactNotification: false,
      autoCancel: true,
      extra: { itineraryId: item.id },
    }] })
    return true
  }

  const bridge = desktopBridge()
  if (!bridge) return false
  const result = await bridge.scheduleNotification({
    id: item.id,
    title: `行程即将开始：${item.title}`,
    body: reminderBody(item),
    at: at.toISOString(),
  })
  return result.scheduled
}

export async function syncItineraryReminders(items: ItineraryItem[]) {
  const futureItems = items.filter(item => {
    const at = itineraryReminderAt(item)
    return at && at.getTime() > Date.now()
  })

  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.cancelAll()
    if (!futureItems.length || !await nativePermission(false)) return 0
    await ensureAndroidChannel()
    await LocalNotifications.schedule({ notifications: futureItems.map(item => ({
      id: item.id,
      title: `行程即将开始：${item.title}`,
      body: reminderBody(item),
      schedule: { at: itineraryReminderAt(item)!, allowWhileIdle: true },
      channelId: CHANNEL_ID,
      foreground: true,
      isExactNotification: false,
      autoCancel: true,
      extra: { itineraryId: item.id },
    })) })
    return futureItems.length
  }

  const bridge = desktopBridge()
  if (!bridge) return 0
  await bridge.cancelAllNotifications()
  const results = await Promise.all(futureItems.map(item => scheduleItineraryReminder(item)))
  return results.filter(Boolean).length
}

export async function cancelAllItineraryReminders() {
  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.cancelAll()
    return
  }
  await desktopBridge()?.cancelAllNotifications()
}
