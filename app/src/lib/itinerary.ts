import type { City, Inspiration, ItineraryItem, Place, Reservation, ReservationAttachment } from '../types'

export interface ItineraryDayGroup {
  date: string
  items: ItineraryItem[]
}

export function reservationIdsFor(item: ItineraryItem) {
  return [...(item.reservation_ids || []), item.reservation_id]
    .filter((id): id is number => Boolean(id))
    .filter((id, index, all) => all.indexOf(id) === index)
}

export function groupItineraryByDay(items: ItineraryItem[]): ItineraryDayGroup[] {
  const groups = items.reduce<Record<string, ItineraryItem[]>>((result, item) => {
    ;(result[item.date] ??= []).push(item)
    return result
  }, {})

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayItems]) => ({
      date,
      items: [...dayItems].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }))
}

export function splitItineraryDaysByToday(days: ItineraryDayGroup[], today: string) {
  return {
    pastDays: days.filter(day => day.date < today),
    currentDays: days.filter(day => day.date >= today),
  }
}

export function countItineraryItems(days: ItineraryDayGroup[]) {
  return days.reduce((sum, day) => sum + day.items.length, 0)
}

export function buildAttachmentCounts(attachments: ReservationAttachment[]) {
  const counts = new Map<number, number>()
  attachments.forEach(file => counts.set(file.reservation_id, (counts.get(file.reservation_id) || 0) + 1))
  return counts
}

export function buildCitySections(activeCity: City | undefined, cities: City[], items: ItineraryItem[]) {
  const citySections = (activeCity ? [activeCity] : cities).map(city => [city, items.filter(item => item.city_id === city.id)] as [City, ItineraryItem[]])
  const unassigned = items.filter(item => !item.city_id)
  if (!activeCity && unassigned.length) citySections.push([null as unknown as City, unassigned])
  return citySections
}

export function buildItineraryExportTable({ tripName, activeCity, items, cityById, placeById, reservationById, inspirationById }: {
  tripName: string
  activeCity?: City
  items: ItineraryItem[]
  cityById: Map<number, City>
  placeById: Map<number, Place>
  reservationById: Map<number, Reservation>
  inspirationById: Map<number, Inspiration>
}) {
  return {
    title: `${tripName} · 城市日程`,
    description: activeCity ? `${activeCity.name}的日程清单` : '当前城市日程清单',
    columns: [{ label: '日期 / 时间' }, { label: '日程' }, { label: '城市 / 类型' }, { label: '关联地点' }, { label: '关联预约' }, { label: '关联灵感' }, { label: '备注' }],
    rows: items.map(item => {
      const place = item.place_id ? placeById.get(item.place_id) : undefined
      const reservations = reservationIdsFor(item).map(id => reservationById.get(id)?.name).filter(Boolean).join('、')
      return [
        `${item.date} ${item.start_time}${item.end_time ? `–${item.end_time}` : ''}`,
        item.title,
        `${item.city_id ? cityById.get(item.city_id)?.name || '未指定城市' : '跨城市 / 未指定'} · ${item.type}`,
        place ? [place.name, place.address].filter(Boolean).join(' · ') : item.location || '—',
        reservations || '—',
        item.inspiration_id ? inspirationById.get(item.inspiration_id)?.title || '已删除' : '—',
        item.note || '—',
      ]
    }),
  }
}

export function itineraryMatches(
  item: ItineraryItem,
  query: string,
  context: {
    place?: Place
    reservations?: Reservation[]
    inspiration?: Inspiration
  } = {},
) {
  if (!query) return true

  const haystack = [
    item.title,
    item.date,
    item.type,
    item.note,
    item.location,
    context.place?.name,
    context.place?.address,
    context.inspiration?.title,
    context.inspiration?.platform,
    ...(context.reservations || []).map(reservation => reservation.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('zh-CN')

  return haystack.includes(query)
}
