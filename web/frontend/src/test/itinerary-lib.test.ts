import { describe, expect, it } from 'vitest'
import { buildAttachmentCounts, buildCitySections, groupItineraryByDay, splitItineraryDaysByToday } from '../lib/itinerary'
import type { City, ItineraryItem, ReservationAttachment } from '../types'

function itinerary(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    id: 1,
    trip_id: 1,
    title: '抵达东京',
    date: '2026-06-30',
    start_time: '10:00',
    end_time: null,
    type: '交通',
    location: null,
    note: null,
    reservation_id: null,
    place_id: null,
    map_url: null,
    image_url: null,
    city_id: null,
    ...overrides,
  }
}

describe('itinerary helpers', () => {
  it('groups days by date and sorts items by time', () => {
    const days = groupItineraryByDay([
      itinerary({ id: 1, date: '2026-07-01', start_time: '18:00' }),
      itinerary({ id: 2, date: '2026-06-29', start_time: '09:00' }),
      itinerary({ id: 3, date: '2026-07-01', start_time: '08:00' }),
    ])

    expect(days.map(day => day.date)).toEqual(['2026-06-29', '2026-07-01'])
    expect(days[1].items.map(item => item.id)).toEqual([3, 1])
  })

  it('splits past days from today and upcoming days', () => {
    const days = groupItineraryByDay([
      itinerary({ id: 1, date: '2026-06-28' }),
      itinerary({ id: 2, date: '2026-06-29' }),
      itinerary({ id: 3, date: '2026-06-30' }),
    ])

    const { pastDays, currentDays } = splitItineraryDaysByToday(days, '2026-06-29')
    expect(pastDays.map(day => day.date)).toEqual(['2026-06-28'])
    expect(currentDays.map(day => day.date)).toEqual(['2026-06-29', '2026-06-30'])
  })

  it('counts reservation attachments', () => {
    const attachments = [
      { reservation_id: 1 },
      { reservation_id: 1 },
      { reservation_id: 2 },
    ] as ReservationAttachment[]

    expect(buildAttachmentCounts(attachments).get(1)).toBe(2)
    expect(buildAttachmentCounts(attachments).get(2)).toBe(1)
  })

  it('builds city sections with unassigned itinerary items', () => {
    const city = { id: 9, name: '东京' } as City
    const sections = buildCitySections(undefined, [city], [
      itinerary({ id: 1, city_id: 9 }),
      itinerary({ id: 2, city_id: null }),
    ])

    expect(sections.map(([sectionCity]) => sectionCity?.name || '未分组')).toEqual(['东京', '未分组'])
    expect(sections.map(([, items]) => items.map(item => item.id))).toEqual([[1], [2]])
  })
})
