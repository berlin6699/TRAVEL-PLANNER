import { useEffect, useState } from 'react'
import { Building2, CalendarRange, MapPin } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { ItinerarySchedule, type ItineraryScheduleProps } from '../components/ItinerarySchedule'
import MapPreview, { type MapTarget } from '../components/MapPreview'
import { ItineraryForm } from '../components/ResourceForms'
import { EmptyState, ErrorBanner, Loading, Modal, PageHeader } from '../components/UI'
import { useLoad } from '../hooks/useLoad'
import { useTrip } from '../contexts/TripContext'
import { buildAttachmentCounts, buildCitySections } from '../lib/itinerary'
import type { City, ItineraryItem, NewItem } from '../types'
import { formatDate } from '../utils'

export default function Itinerary() {
  const { selectedTrip } = useTrip()
  const tripId = selectedTrip!.id
  const { data, loading, error, reload } = useLoad(async () => {
    const [items, reservations, places, cities, attachments] = await Promise.all([
      api.itinerary.list({ trip_id: tripId }),
      api.reservations.list({ trip_id: tripId }),
      api.places.list({ trip_id: tripId }),
      api.cities.list({ trip_id: tripId }),
      api.reservationAttachments.list(tripId),
    ])
    return { items, reservations, places, cities, attachments }
  })

  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const requestedCityId = Number(params.get('city_id')) || null
  const [editing, setEditing] = useState<ItineraryItem | null | undefined>(undefined)
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null)
  const [view, setView] = useState<'time' | 'city'>(requestedCityId ? 'city' : 'time')

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
  const reservationById = new Map(data.reservations.map(reservation => [reservation.id, reservation]))
  const attachmentCountByReservation = buildAttachmentCounts(data.attachments)
  const activeCity = requestedCityId ? cityById.get(requestedCityId) : undefined
  const citySections = buildCitySections(activeCity, data.cities, data.items)

  const clearCity = () => {
    const next = new URLSearchParams(params)
    next.delete('city_id')
    setParams(next, { replace: true })
  }
  const showTime = () => {
    setView('time')
    clearCity()
  }
  const scheduleProps: Omit<ItineraryScheduleProps, 'items' | 'hideCity'> = { cityById, reservationById, attachmentCountByReservation, onEdit: setEditing, onDelete: remove, onMap: setMapTarget, onReservation: (id: number) => navigate(`/reservations?id=${id}&files=1`) }

  return <div>
    <PageHeader title="城市日程" description="默认按日期和时间查看整段旅程，也可以切换成按城市归类。" action="新增日程" onAction={() => setEditing(null)}/>
    <ErrorBanner message={error}/>
    <div className="control-panel mb-6 flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-2xl bg-white p-1 shadow-sm">
        <button onClick={showTime} className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold ${view === 'time' ? 'bg-coral-500 text-white' : 'text-stone-500'}`}><CalendarRange size={17}/>按时间</button>
        <button onClick={() => setView('city')} className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold ${view === 'city' ? 'bg-coral-500 text-white' : 'text-stone-500'}`}><Building2 size={17}/>按城市</button>
      </div>
      {activeCity && view === 'city' && <div className="inline-flex items-center gap-2 rounded-2xl border border-mint-100 bg-mint-50 px-4 py-2 text-sm text-mint-600"><MapPin size={16}/><span>正在查看 <b>{activeCity.name}</b></span><button onClick={clearCity} className="ml-1 font-semibold text-stone-500 transition hover:text-coral-600">全部城市</button></div>}
    </div>
    {!data.items.length ? <EmptyState title="还没有日程" message="从抵达、入住或第一项活动开始安排吧。" action="新增日程" onAction={() => setEditing(null)}/> : view === 'time' ? <ItinerarySchedule items={data.items} {...scheduleProps}/> : activeCity && !citySections[0][1].length ? <EmptyState title={`${activeCity.name}还没有日程`} message="可以新增一项日程，并把它归到这座城市。" action="新增日程" onAction={() => setEditing(null)}/> : <CityScheduleSections sections={citySections} scheduleProps={scheduleProps}/>}
    <Modal open={editing !== undefined} title={editing ? '编辑日程' : '新增日程'} onClose={() => setEditing(undefined)}>
      <ItineraryForm key={editing?.id || 'new'} item={editing} reservations={data.reservations} places={data.places} cities={data.cities} tripId={tripId} onSave={save} onCancel={() => setEditing(undefined)}/>
    </Modal>
    <MapPreview target={mapTarget} onClose={() => setMapTarget(null)}/>
  </div>
}

function CityScheduleSections({ sections, scheduleProps }: { sections: [City, ItineraryItem[]][]; scheduleProps: Omit<ItineraryScheduleProps, 'items' | 'hideCity'> }) {
  return <div className="space-y-10">
    {sections.map(([city, items]) => items.length ? <section key={city?.id || 'unassigned'}>
      <div className="card mb-5 flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-coral-600">{city ? 'CITY' : 'CROSS CITY'}</p><h2 className="mt-1 text-2xl font-bold">{city?.name || '跨城市 / 未分组'}</h2></div>
        {city && <div className="text-sm text-stone-500">{city.arrival_date && formatDate(city.arrival_date)}{city.departure_date && ` — ${formatDate(city.departure_date)}`}</div>}
      </div>
      <ItinerarySchedule items={items} hideCity {...scheduleProps}/>
    </section> : null)}
  </div>
}
