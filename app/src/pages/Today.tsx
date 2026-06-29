import { Backpack, CalendarCheck, CalendarClock, CheckCircle2, Clock3, FileText, MapPin, NotebookTabs, ReceiptText, WalletCards } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Badge, EmptyState, ErrorBanner, IconButton, Loading, PageHeader } from '../components/UI'
import { useLoad } from '../hooks/useLoad'
import { useTrip } from '../contexts/TripContext'
import { reservationIdsFor } from '../lib/itinerary'
import type { ChecklistItem, ItineraryItem, Place, Reservation, ReservationAttachment } from '../types'
import { formatDate, formatMoney, todayDateKey } from '../utils'

function currentTimeKey(now = new Date()) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function sortItinerary(items: ItineraryItem[]) {
  return [...items].sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`))
}

function buildAttachmentMap(attachments: ReservationAttachment[]) {
  const map = new Map<number, ReservationAttachment[]>()
  attachments.forEach(file => map.set(file.reservation_id, [...(map.get(file.reservation_id) || []), file]))
  return map
}

function uniqueReservations(items: (Reservation | undefined)[]) {
  const seen = new Set<number>()
  return items.filter((item): item is Reservation => {
    if (!item || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export default function Today() {
  const { selectedTrip } = useTrip()
  const trip = selectedTrip!
  const tripId = trip.id
  const navigate = useNavigate()
  const today = todayDateKey()
  const nowTime = currentTimeKey()
  const { data, loading, error, reload } = useLoad(async () => {
    const [itinerary, reservations, attachments, checklist, expenses, places] = await Promise.all([
      api.itinerary.list({ trip_id: tripId }),
      api.reservations.list({ trip_id: tripId }),
      api.reservationAttachments.list(tripId),
      api.checklist.list({ trip_id: tripId }),
      api.expenses.list({ trip_id: tripId }),
      api.places.list({ trip_id: tripId }),
    ])
    return { itinerary, reservations, attachments, checklist, expenses, places }
  })

  const finishChecklist = async (item: ChecklistItem) => {
    const { id: _, ...payload } = item
    await api.checklist.update(item.id, { ...payload, completed: true })
    await reload()
  }

  if (loading) return <Loading/>
  if (!data) return <ErrorBanner message={error}/>

  const reservationById = new Map(data.reservations.map(item => [item.id, item]))
  const placeById = new Map(data.places.map(item => [item.id, item]))
  const attachmentsByReservation = buildAttachmentMap(data.attachments)
  const orderedItinerary = sortItinerary(data.itinerary)
  const todayItems = orderedItinerary.filter(item => item.date === today)
  const nextItem = orderedItinerary.find(item => item.date > today || (item.date === today && item.start_time.slice(0, 5) >= nowTime)) || orderedItinerary.find(item => item.date >= today)
  const linkedReservationIds = todayItems.flatMap(reservationIdsFor)
  const todayReservations = uniqueReservations([
    ...linkedReservationIds.map(id => reservationById.get(id)),
    ...data.reservations.filter(item => item.date === today),
  ])
  const todayChecklist = data.checklist
    .filter(item => !item.completed && (!item.due_date || item.due_date <= today))
    .sort((a, b) => `${a.due_date || '9999-99-99'} ${a.order_index}`.localeCompare(`${b.due_date || '9999-99-99'} ${b.order_index}`))
  const todayExpenses = data.expenses.filter(item => item.date === today)
  const todaySpent = todayExpenses.reduce((sum, item) => sum + Number(item.amount), 0)

  return <div>
    <PageHeader title="旅行当天模式" description="把今天真正会用到的日程、票据、待办和花销放在一个页面里。" action="记一笔" onAction={() => navigate('/expenses?new=1')}/>
    <ErrorBanner message={error}/>
    <section className="relative mb-6 overflow-hidden rounded-4xl bg-gradient-to-br from-stone-900 via-[#303029] to-[#3e322d] p-6 text-white shadow-[0_28px_70px_-30px_rgba(41,40,36,.8)] sm:p-8">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-coral-500/25 blur-3xl"/>
      <p className="text-xs font-bold uppercase tracking-[.22em] text-coral-200">Today · {formatDate(today, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight">{trip.name}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <TodayMetric icon={<CalendarCheck size={18}/>} label="今日日程" value={`${todayItems.length} 项`}/>
        <TodayMetric icon={<NotebookTabs size={18}/>} label="今日预约" value={`${todayReservations.length} 项`}/>
        <TodayMetric icon={<WalletCards size={18}/>} label="今日花销" value={formatMoney(todaySpent, 'CNY')}/>
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <section className="section-card section-coral p-6">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-bold">下一步</h2><Link to="/itinerary" className="text-xs font-semibold text-coral-600">全部日程</Link></div>
        {nextItem ? <NextItineraryCard item={nextItem} place={nextItem.place_id ? placeById.get(nextItem.place_id) : undefined}/> : <EmptyState title="接下来没有日程" message="如果今天还有安排，可以去日程页添加一项。" action="新增日程" onAction={() => navigate('/itinerary?new=1')}/>}
      </section>

      <section className="section-card section-mint p-6">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-bold">今日待办 / 行李</h2><Link to="/checklist" className="text-xs font-semibold text-coral-600">清单</Link></div>
        {todayChecklist.length ? <div className="space-y-3">{todayChecklist.slice(0, 8).map(item => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 shadow-sm"><span className="rounded-xl bg-mint-50 p-2 text-mint-600">{item.kind === '行李' ? <Backpack size={17}/> : <CalendarClock size={17}/>}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.title}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</p><p className="text-xs text-stone-400">{item.category || item.kind}{item.due_date ? ` · ${item.due_date < today ? '已到期' : '今天截止'}` : ' · 随时可做'}</p></div><IconButton aria-label="完成" onClick={() => void finishChecklist(item)}><CheckCircle2 size={18}/></IconButton></div>)}</div> : <p className="text-sm leading-6 text-stone-400">今天没有待办压力，轻装上阵。</p>}
      </section>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <TodaySchedule items={todayItems} placeById={placeById}/>
      <TodayReservations reservations={todayReservations} attachmentsByReservation={attachmentsByReservation}/>
      <TodayExpenses expenses={todayExpenses} total={todaySpent}/>
    </div>
  </div>
}

function TodayMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[.07] p-4 backdrop-blur"><div className="flex items-center gap-2 text-sm text-stone-300">{icon}{label}</div><p className="mt-2 text-xl font-bold">{value}</p></div>
}

function NextItineraryCard({ item, place }: { item: ItineraryItem; place?: Place }) {
  const location = place ? [place.name, place.address].filter(Boolean).join(' · ') : item.location
  return <Link to={item.city_id ? `/itinerary?city_id=${item.city_id}` : '/itinerary'} className="pressable-card block rounded-3xl border border-coral-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
    <div className="flex flex-wrap items-center gap-2"><Badge tone={item.date === todayDateKey() ? 'coral' : 'sky'}>{item.date === todayDateKey() ? '今天' : formatDate(item.date)}</Badge><Badge tone="stone">{item.type}</Badge></div>
    <h3 className="mt-3 text-2xl font-extrabold">{item.title}</h3>
    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-coral-600"><Clock3 size={16}/>{item.start_time.slice(0, 5)}{item.end_time ? ` — ${item.end_time.slice(0, 5)}` : ''}</p>
    {location && <p className="mt-2 flex items-start gap-1.5 text-sm text-stone-500"><MapPin className="mt-0.5 shrink-0" size={15}/>{location}</p>}
  </Link>
}

function TodaySchedule({ items, placeById }: { items: ItineraryItem[]; placeById: Map<number, Place> }) {
  return <section className="section-card section-coral p-6"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-bold">今日日程</h2><Link to="/itinerary" className="text-xs font-semibold text-coral-600">日程页</Link></div>{items.length ? <div className="space-y-4 border-l-2 border-coral-100 pl-5">{items.map(item => { const place = item.place_id ? placeById.get(item.place_id) : undefined; const location = place ? [place.name, place.address].filter(Boolean).join(' · ') : item.location; return <Link key={item.id} to={item.city_id ? `/itinerary?city_id=${item.city_id}` : '/itinerary'} className="pressable-card relative block rounded-2xl bg-white/80 p-4 shadow-sm transition hover:bg-coral-50"><span className="absolute -left-[27px] top-5 h-3 w-3 rounded-full bg-coral-500 ring-4 ring-white"/><p className="text-xs font-bold text-coral-600">{item.start_time.slice(0, 5)}</p><p className="mt-1 font-semibold">{item.title}</p>{location && <p className="mt-1 flex items-start gap-1 text-xs text-stone-400"><MapPin className="mt-0.5 shrink-0" size={12}/>{location}</p>}</Link> })}</div> : <p className="text-sm leading-6 text-stone-400">今天没有安排。你可以休息，也可以临时加一点小探索。</p>}</section>
}

function TodayReservations({ reservations, attachmentsByReservation }: { reservations: Reservation[]; attachmentsByReservation: Map<number, ReservationAttachment[]> }) {
  return <section className="section-card section-sky p-6"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-bold">今日预约与票据</h2><Link to="/reservations" className="text-xs font-semibold text-coral-600">预约页</Link></div>{reservations.length ? <div className="space-y-3">{reservations.map(reservation => { const files = attachmentsByReservation.get(reservation.id) || []; return <div key={reservation.id} className="rounded-2xl bg-white/80 p-4 shadow-sm"><div className="flex items-start gap-3"><span className="rounded-xl bg-skysoft-50 p-2 text-sky-700"><FileText size={17}/></span><div className="min-w-0 flex-1"><Link to={`/reservations?id=${reservation.id}&files=1`} className="font-semibold hover:text-coral-600">{reservation.name}</Link><p className="mt-1 text-xs text-stone-400">{reservation.type} · {reservation.time || '时间待定'} · {reservation.status}</p></div></div>{files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{files.map(file => <button key={file.id} className="rounded-full bg-coral-50 px-3 py-1.5 text-xs font-semibold text-coral-600" onClick={() => void api.reservationAttachments.open(file.id)}>打开 {file.original_name}</button>)}</div>}</div>})}</div> : <p className="text-sm leading-6 text-stone-400">今天没有预约或票据需要处理。</p>}</section>
}

function TodayExpenses({ expenses, total }: { expenses: { id: number; title: string; amount: number; category: string }[]; total: number }) {
  return <section className="section-card section-mint p-6 xl:col-span-2"><div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-bold">今日花销</h2><p className="mt-1 text-xs text-stone-400">今日合计 {formatMoney(total, 'CNY')}</p></div><Link to="/expenses?new=1" className="secondary-btn text-xs"><ReceiptText size={15}/>记一笔</Link></div>{expenses.length ? <div className="grid gap-3 sm:grid-cols-2">{expenses.slice(0, 6).map(expense => <div key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-4 shadow-sm"><div className="min-w-0"><p className="truncate font-semibold">{expense.title}</p><p className="mt-1 text-xs text-stone-400">{expense.category}</p></div><b>{formatMoney(Number(expense.amount), 'CNY')}</b></div>)}</div> : <p className="text-sm leading-6 text-stone-400">今天还没有记录花销。</p>}</section>
}
