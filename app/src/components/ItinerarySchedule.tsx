import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Clock, Edit3, FileText, History, MapPin, Sparkles, Trash2 } from 'lucide-react'
import { MapButton, type MapTarget } from './MapPreview'
import { Badge, IconButton } from './UI'
import { countItineraryItems, groupItineraryByDay, reservationIdsFor, splitItineraryDaysByToday, type ItineraryDayGroup } from '../lib/itinerary'
import type { City, Inspiration, ItineraryItem, Place, Reservation } from '../types'
import { formatDate, todayDateKey } from '../utils'

export interface ItineraryScheduleProps {
  items: ItineraryItem[]
  cityById: Map<number, City>
  placeById: Map<number, Place>
  reservationById: Map<number, Reservation>
  inspirationById: Map<number, Inspiration>
  attachmentCountByReservation: Map<number, number>
  hideCity?: boolean
  onEdit: (item: ItineraryItem) => void
  onDelete: (item: ItineraryItem) => Promise<void>
  onMap: (target: MapTarget) => void
  onReservation: (id: number) => void
  onInspiration: (id: number) => void
}

export function ItinerarySchedule({
  items,
  cityById,
  placeById,
  reservationById,
  inspirationById,
  attachmentCountByReservation,
  hideCity = false,
  onEdit,
  onDelete,
  onMap,
  onReservation,
  onInspiration,
}: ItineraryScheduleProps) {
  const today = todayDateKey()
  const [showPast, setShowPast] = useState(false)
  const dayGroups = useMemo(() => groupItineraryByDay(items), [items])
  const { pastDays, currentDays } = useMemo(() => splitItineraryDaysByToday(dayGroups, today), [dayGroups, today])
  const pastCount = countItineraryItems(pastDays)

  return <div className="space-y-7">
    {pastCount > 0 && <PastDaysDisclosure days={pastDays} count={pastCount} open={showPast} onToggle={() => setShowPast(value => !value)}>
      {pastDays.map(day => <ScheduleDay key={day.date} day={day} today={today} isPast cityById={cityById} placeById={placeById} reservationById={reservationById} inspirationById={inspirationById} attachmentCountByReservation={attachmentCountByReservation} hideCity={hideCity} onEdit={onEdit} onDelete={onDelete} onMap={onMap} onReservation={onReservation} onInspiration={onInspiration}/>)}
    </PastDaysDisclosure>}
    {currentDays.map(day => <ScheduleDay key={day.date} day={day} today={today} cityById={cityById} placeById={placeById} reservationById={reservationById} inspirationById={inspirationById} attachmentCountByReservation={attachmentCountByReservation} hideCity={hideCity} onEdit={onEdit} onDelete={onDelete} onMap={onMap} onReservation={onReservation} onInspiration={onInspiration}/>)}
    {!currentDays.length && pastCount > 0 && <div className="rounded-3xl border border-dashed border-coral-200 bg-coral-50/50 p-6 text-center text-sm leading-6 text-stone-500">今天和之后暂时没有日程，过去的安排已经收纳在上方。</div>}
  </div>
}

function PastDaysDisclosure({ days, count, open, onToggle, children }: { days: ItineraryDayGroup[]; count: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className="rounded-[1.75rem] border border-stone-200/80 bg-white/80 p-3 shadow-sm shadow-stone-200/40 backdrop-blur">
    <button type="button" className="flex w-full items-center gap-3 rounded-[1.35rem] px-3 py-3 text-left transition hover:bg-stone-50" onClick={onToggle} aria-expanded={open}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-500"><History size={18}/></span>
      <span className="min-w-0 flex-1"><span className="block font-bold text-stone-800">过去日程已折叠</span><span className="block text-xs leading-5 text-stone-400">{days.length} 天 · {count} 项安排，需要回看时再展开</span></span>
      <ChevronDown className={`shrink-0 text-stone-400 transition ${open ? 'rotate-180' : ''}`} size={20}/>
    </button>
    {open && <div className="mt-4 space-y-7 border-t border-stone-100 px-1 pt-5 sm:px-3">{children}</div>}
  </section>
}

function ScheduleDay(props: Omit<ItineraryScheduleProps, 'items'> & { day: ItineraryDayGroup; today: string; isPast?: boolean }) {
  const { day, today, isPast = false } = props
  const isToday = day.date === today

  return <div>
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold">{formatDate(day.date, { month: 'long', day: 'numeric', weekday: 'long' })}</h3>
          {isToday && <Badge tone="coral">今天</Badge>}
          {isPast && <Badge tone="stone">已过去</Badge>}
        </div>
        <p className="mt-1 text-xs text-stone-400">{day.items.length} 项安排</p>
      </div>
    </div>
    <div className={`space-y-3 border-l-2 pl-5 sm:pl-8 ${isPast ? 'border-stone-200' : 'border-coral-100'}`}>
      {day.items.map(item => <ScheduleCard key={item.id} item={item} {...props}/>)}
    </div>
  </div>
}

function ScheduleCard({
  item,
  isPast = false,
  cityById,
  placeById,
  reservationById,
  inspirationById,
  attachmentCountByReservation,
  hideCity,
  onEdit,
  onDelete,
  onMap,
  onReservation,
  onInspiration,
}: Omit<ItineraryScheduleProps, 'items'> & { item: ItineraryItem; day: ItineraryDayGroup; today: string; isPast?: boolean }) {
  const place = item.place_id ? placeById.get(item.place_id) : undefined
  const inspiration = item.inspiration_id ? inspirationById.get(item.inspiration_id) : undefined
  const reservations = reservationIdsFor(item).map(id => reservationById.get(id)).filter((reservation): reservation is Reservation => Boolean(reservation))
  const location = place ? [place.name, place.address].filter(Boolean).join(' · ') : item.location
  const mapUrl = item.map_url || place?.map_url

  return <article className={`card relative p-5 ${isPast ? 'bg-white/80 opacity-90' : ''}`}>
    <span className={`absolute -left-[27px] top-7 h-3 w-3 rounded-full ring-4 sm:-left-[39px] ${isPast ? 'bg-stone-300 ring-white' : 'bg-coral-500 ring-cream'}`}/>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className={`flex min-w-24 items-center gap-2 font-bold ${isPast ? 'text-stone-400' : 'text-coral-600'}`}><Clock size={16}/>{item.start_time.slice(0, 5)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="break-words text-lg font-bold">{item.title}</h4>
          <Badge tone={item.type === '景点' ? 'mint' : 'sky'}>{item.type}</Badge>
          {!hideCity && item.city_id && <Badge tone="stone">{cityById.get(item.city_id)?.name}</Badge>}
        </div>
        {location && <p className="mt-2 flex items-start gap-1.5 break-words text-sm text-stone-500"><MapPin className="mt-0.5 shrink-0" size={15}/>{location}</p>}
        {item.note && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-500">{item.note}</p>}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {mapUrl && <MapButton target={{ title: item.title, url: mapUrl, query: location }} onOpen={onMap}/>}
          {inspiration && <button className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-mint-600" onClick={() => onInspiration(inspiration.id)}><Sparkles size={15}/>查看灵感 · <span className="max-w-48 truncate">{inspiration.title}</span></button>}
          {reservations.map(reservation => {
            const attachmentCount = attachmentCountByReservation.get(reservation.id) || 0
            return <button key={reservation.id} className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral-600" onClick={() => onReservation(reservation.id)}><FileText size={15}/>查看 {reservation.name}{attachmentCount ? ` 的 PDF (${attachmentCount})` : ' 预约'}</button>
          })}
        </div>
      </div>
      <div className="flex shrink-0"><IconButton aria-label="编辑" onClick={() => onEdit(item)}><Edit3 size={17}/></IconButton><IconButton aria-label="删除" onClick={() => void onDelete(item)}><Trash2 size={17}/></IconButton></div>
    </div>
  </article>
}
