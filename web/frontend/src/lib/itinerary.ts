import type { City, ItineraryItem, ReservationAttachment } from '../types'

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
