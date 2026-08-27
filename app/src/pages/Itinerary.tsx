import { useEffect, useState } from 'react'
import { Building2, CalendarRange, MapPin, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { DocumentExportActions } from '../components/DocumentExportActions'
import { ItinerarySchedule, type ItineraryScheduleProps } from '../components/ItinerarySchedule'
import MapPreview, { type MapTarget } from '../components/MapPreview'
import { ItineraryForm } from '../components/ResourceForms'
import { EmptyState, ErrorBanner, Loading, Modal, PageHeader } from '../components/UI'
import { useLoad } from '../hooks/useLoad'
import { useTrip } from '../contexts/TripContext'
import { buildAttachmentCounts, buildCitySections, buildItineraryExportTable, itineraryMatches, reservationIdsFor } from '../lib/itinerary'
import { requestItineraryReminderPermission } from '../services/localNotifications'
import type { City, ItineraryItem, NewItem, Reservation } from '../types'
import { formatDate } from '../utils'

export default function Itinerary() {
  const { selectedTrip } = useTrip()
  const tripId = selectedTrip!.id
  const { data, loading, error, reload } = useLoad(async () => {
    const [items, reservations, inspirations, places, cities, attachments] = await Promise.all([
      api.itinerary.list({ trip_id: tripId }),
      api.reservations.list({ trip_id: tripId }),
      api.inspirations.list({ trip_id: tripId }),
      api.places.list({ trip_id: tripId }),
      api.cities.list({ trip_id: tripId }),
      api.reservationAttachments.list(tripId),
    ])
    return { items, reservations, inspirations, places, cities, attachments }
  })

  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const requestedCityId = Number(params.get('city_id')) || null
  const [editing, setEditing] = useState<ItineraryItem | null | undefined>(undefined)
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null)
  const [view, setView] = useState<'time' | 'city'>(requestedCityId ? 'city' : 'time')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing(null)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  useEffect(() => {
    if (requestedCityId) setView('city')
  }, [requestedCityId])

  const save = async (value: NewItem<ItineraryItem>) => {
    await requestItineraryReminderPermission(value)
    if (editing) await api.itinerary.update(editing.id, value)
    else await api.itinerary.create(value)
    setEditing(undefined)
    await reload()
  }

  const remove = async (item: ItineraryItem) => {
    if (confirm(`确定删除“${item.title}”吗？`)) {
      await api.itinerary.remove(item.id)
      await reload()
    }
  }

  if (loading) return <Loading/>
  if (!data) return <ErrorBanner message={error}/>

  const cityById = new Map(data.cities.map(city => [city.id, city]))
  const placeById = new Map(data.places.map(place => [place.id, place]))
  const reservationById = new Map(data.reservations.map(reservation => [reservation.id, reservation]))
  const inspirationById = new Map(data.inspirations.map(inspiration => [inspiration.id, inspiration]))
  const attachmentCountByReservation = buildAttachmentCounts(data.attachments)
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')
  const activeCity = requestedCityId ? cityById.get(requestedCityId) : undefined
  const matchedItems = data.items.filter(item => {
    const reservations = reservationIdsFor(item)
      .map(id => reservationById.get(id))
      .filter((reservation): reservation is Reservation => Boolean(reservation))
    return itineraryMatches(item, normalizedQuery, {
      place: item.place_id ? placeById.get(item.place_id) : undefined,
      reservations,
      inspiration: item.inspiration_id ? inspirationById.get(item.inspiration_id) : undefined,
    })
  })
  const citySections = buildCitySections(activeCity, data.cities, matchedItems)
  const exportTable = buildItineraryExportTable({
    tripName: selectedTrip!.name,
    activeCity,
    items: matchedItems,
    cityById,
    placeById,
    reservationById,
    inspirationById,
  })
  const scheduleProps: Omit<ItineraryScheduleProps, 'items' | 'hideCity'> = {
    cityById,
    placeById,
    reservationById,
    inspirationById,
    attachmentCountByReservation,
    onEdit: setEditing,
    onDelete: remove,
    onMap: setMapTarget,
    onReservation: id => navigate(`/reservations?id=${id}&files=1`),
    onInspiration: id => navigate(`/inspirations?id=${id}`),
  }

  const clearCity = () => {
    const next = new URLSearchParams(params)
    next.delete('city_id')
    setParams(next, { replace: true })
  }
  const showTime = () => {
    setView('time')
    clearCity()
  }

  return <div>
    <PageHeader title="城市日程" description="默认按日期和时间查看整段旅程，也可以切换成按城市归类。" action="新增日程" onAction={() => setEditing(null)}/>
    <ErrorBanner message={error}/>
    <div className="control-panel mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="inline-flex self-start rounded-2xl bg-white p-1 shadow-sm">
        <button onClick={showTime} className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold ${view === 'time' ? 'bg-coral-500 text-white' : 'text-stone-500'}`}><CalendarRange size={17}/>按时间</button>
        <button onClick={() => setView('city')} className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold ${view === 'city' ? 'bg-coral-500 text-white' : 'text-stone-500'}`}><Building2 size={17}/>按城市</button>
      </div>
      <label className="relative block min-w-0 lg:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16}/>
        <input aria-label="搜索日程" className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-coral-400" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索日程、地点或预约"/>
      </label>
    </div>
    {activeCity && view === 'city' && <div className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-mint-100 bg-mint-50 px-4 py-2 text-sm text-mint-600"><MapPin size={16}/><span>正在查看 <b>{activeCity.name}</b></span><button onClick={clearCity} className="ml-1 font-semibold text-stone-500 transition hover:text-coral-600">全部城市</button></div>}
    <DocumentExportActions table={exportTable}/>
    <ItineraryContent
      view={view}
      query={query}
      items={matchedItems}
      citySections={citySections}
      activeCity={activeCity}
      scheduleProps={scheduleProps}
      onNew={() => setEditing(null)}
    />
    <Modal open={editing !== undefined} title={editing ? '编辑日程' : '新增日程'} onClose={() => setEditing(undefined)}>
      <ItineraryForm key={editing?.id || 'new'} item={editing} reservations={data.reservations} inspirations={data.inspirations} places={data.places} cities={data.cities} tripId={tripId} onSave={save} onCancel={() => setEditing(undefined)}/>
    </Modal>
    <MapPreview target={mapTarget} onClose={() => setMapTarget(null)}/>
  </div>
}

function ItineraryContent({
  view,
  query,
  items,
  citySections,
  activeCity,
  scheduleProps,
  onNew,
}: {
  view: 'time' | 'city'
  query: string
  items: ItineraryItem[]
  citySections: [City, ItineraryItem[]][]
  activeCity?: City
  scheduleProps: Omit<ItineraryScheduleProps, 'items' | 'hideCity'>
  onNew: () => void
}) {
  if (!items.length) return <EmptyState title={query ? '没有找到匹配日程' : '还没有日程'} message={query ? '换个关键词，或清空搜索后再试试。' : '从抵达、入住或第一项活动开始安排吧。'} action="新增日程" onAction={onNew}/>
  if (view === 'time') return <ItinerarySchedule items={items} {...scheduleProps}/>
  if (activeCity && !citySections[0][1].length) return <EmptyState title={`${activeCity.name}还没有匹配日程`} message="可以新增一项日程，并把它归到这座城市。" action="新增日程" onAction={onNew}/>

  return <div className="space-y-10">
    {citySections.map(([city, sectionItems]) => sectionItems.length ? <section key={city?.id || 'unassigned'}>
      <div className="card mb-5 flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-coral-600">{city ? 'CITY' : 'CROSS CITY'}</p><h2 className="mt-1 text-2xl font-bold">{city?.name || '跨城市 / 未分组'}</h2></div>
        {city && <div className="text-sm text-stone-500">{city.arrival_date && formatDate(city.arrival_date)}{city.departure_date && ` — ${formatDate(city.departure_date)}`}</div>}
      </div>
      <ItinerarySchedule items={sectionItems} hideCity {...scheduleProps}/>
    </section> : null)}
  </div>
}
