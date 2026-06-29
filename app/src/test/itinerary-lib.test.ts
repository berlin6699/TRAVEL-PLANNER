import { describe, expect, it } from 'vitest'
import { buildAttachmentCounts, buildCitySections, buildItineraryExportTable, groupItineraryByDay, itineraryMatches, reservationIdsFor, splitItineraryDaysByToday } from '../lib/itinerary'
import type { City, Inspiration, ItineraryItem, Place, Reservation, ReservationAttachment } from '../types'

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
    reservation_ids: [],
    inspiration_id: null,
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

  it('normalizes legacy and multi-reservation itinerary links', () => {
    expect(reservationIdsFor(itinerary({ reservation_id: 2, reservation_ids: [1, 2, 1] }))).toEqual([1, 2])
  })

  it('matches linked place, reservation, and inspiration text', () => {
    const place = { name: '涩谷站', address: '东京', map_url: null } as Place
    const reservation = { name: '成田快线', type: '车票' } as Reservation
    const inspiration = { title: '东京咖啡路线', platform: '小红书' } as Inspiration

    expect(itineraryMatches(itinerary(), '涩谷', { place })).toBe(true)
    expect(itineraryMatches(itinerary(), '成田', { reservations: [reservation] })).toBe(true)
    expect(itineraryMatches(itinerary(), '咖啡', { inspiration })).toBe(true)
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

  it('builds export rows with linked metadata', () => {
    const city = { id: 9, name: '东京' } as City
    const place = { id: 3, name: '涩谷站', address: '涩谷' } as Place
    const reservation = { id: 5, name: '成田快线' } as Reservation
    const inspiration = { id: 7, title: '东京咖啡路线' } as Inspiration
    const table = buildItineraryExportTable({
      tripName: '日本旅行',
      items: [itinerary({ city_id: 9, place_id: 3, reservation_ids: [5], inspiration_id: 7 })],
      cityById: new Map([[9, city]]),
      placeById: new Map([[3, place]]),
      reservationById: new Map([[5, reservation]]),
      inspirationById: new Map([[7, inspiration]]),
    })

    expect(table.title).toBe('日本旅行 · 城市日程')
    expect(table.rows[0]).toContain('东京 · 交通')
    expect(table.rows[0]).toContain('涩谷站 · 涩谷')
    expect(table.rows[0]).toContain('成田快线')
    expect(table.rows[0]).toContain('东京咖啡路线')
  })
})
