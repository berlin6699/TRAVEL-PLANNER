import { afterEach, describe, expect, it, vi } from 'vitest'
import { itineraryReminderAt, itineraryStartAt, requestItineraryReminderPermission } from '../services/localNotifications'

afterEach(() => vi.useRealTimers())

describe('本地行程提醒时间', () => {
  it('按设备本地时间计算提前量', () => {
    const item = { date: '2030-06-15', start_time: '09:30', reminder_minutes: 30 }
    const start = itineraryStartAt(item)
    const reminder = itineraryReminderAt(item)
    expect(start?.getHours()).toBe(9)
    expect(start?.getMinutes()).toBe(30)
    expect(reminder?.getHours()).toBe(9)
    expect(reminder?.getMinutes()).toBe(0)
  })

  it('拒绝无效提醒分钟数', () => {
    expect(itineraryReminderAt({ date: '2030-06-15', start_time: '09:30', reminder_minutes: -1 })).toBeNull()
    expect(itineraryReminderAt({ date: '2030-06-15', start_time: '09:30', reminder_minutes: 10081 })).toBeNull()
    expect(itineraryReminderAt({ date: '2030-06-15', start_time: '09:30', reminder_minutes: null })).toBeNull()
  })

  it('阻止保存已经错过的未来日程提醒', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-06-15T09:25:00'))
    await expect(requestItineraryReminderPermission({ date: '2030-06-15', start_time: '09:30', reminder_minutes: 15 })).rejects.toThrow('提醒时间已经过去')
  })
})
