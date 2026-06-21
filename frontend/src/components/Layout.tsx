import { useState } from 'react'
import { CalendarDays, CheckSquare2, Compass, Home, MapPin, Menu, NotebookTabs, Plus, ReceiptText, Settings, X } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../api/client'
import { useTrip } from '../contexts/TripContext'
import type { NewItem, Trip } from '../types'
import { TripForm } from './ResourceForms'
import { Modal } from './UI'

const nav = [
  ['/', '首页', Home], ['/itinerary', '城市日程', CalendarDays], ['/reservations', '预约', NotebookTabs],
  ['/inspirations', '灵感', Compass], ['/places', '城市与路线', MapPin], ['/checklist', '行前清单', CheckSquare2],
  ['/expenses', '记账', ReceiptText], ['/settings', '设置', Settings],
] as const

export default function Layout() {
  const [open, setOpen] = useState(false)
  const [creatingTrip,setCreatingTrip]=useState(false)
  const {trips,selectedTrip,selectTrip,refreshTrips,loading,error}=useTrip()
  const createTrip=async(value:NewItem<Trip>)=>{const created=await api.trips.create(value);await refreshTrips();selectTrip(created.id);setCreatingTrip(false)}
  const sidebar = <aside className="flex h-full w-64 flex-col bg-[#292824] px-4 py-6 text-white">
    <div className="mb-8 flex items-center justify-between px-3"><div><div className="text-2xl font-bold">旅途<span className="text-coral-500">.</span></div><div className="mt-1 text-xs text-stone-400">TRAVEL PLANNER</div></div><button className="md:hidden" onClick={()=>setOpen(false)}><X/></button></div>
    <nav className="space-y-1">{nav.map(([to,label,Icon])=><NavLink key={to} end={to==='/'} to={to} onClick={()=>setOpen(false)} className={({isActive})=>`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${isActive?'bg-coral-500 text-white shadow-lg shadow-coral-500/20':'text-stone-300 hover:bg-white/5 hover:text-white'}`}><Icon size={19}/>{label}</NavLink>)}</nav>
    <div className="mt-auto rounded-2xl bg-white/5 p-4 text-xs leading-5 text-stone-400">把期待收进行囊，<br/>把每一天安排得刚刚好。</div>
  </aside>
  return <div className="min-h-screen bg-cream"><div className="fixed inset-y-0 left-0 z-30 hidden md:block">{sidebar}</div>{open&&<div className="fixed inset-0 z-40 md:hidden"><button aria-label="关闭菜单" className="absolute inset-0 bg-black/40" onClick={()=>setOpen(false)}/>{sidebar}</div>}<main className="min-h-screen md:pl-64"><div className="sticky top-0 z-[500] flex items-center gap-3 border-b border-stone-100 bg-cream/95 px-4 py-3 backdrop-blur md:px-8"><button onClick={()=>setOpen(true)} className="rounded-lg p-2 md:hidden"><Menu/></button><div className="min-w-0 flex-1"><p className="hidden text-[10px] font-bold uppercase tracking-widest text-stone-400 sm:block">当前旅程</p>{trips.length?<select aria-label="选择旅程" className="max-w-full bg-transparent text-sm font-bold outline-none sm:text-base" value={selectedTrip?.id||''} onChange={e=>selectTrip(Number(e.target.value))}>{trips.map(trip=><option key={trip.id} value={trip.id}>{trip.name} · {trip.start_date} 至 {trip.end_date}</option>)}</select>:<p className="text-sm font-semibold text-stone-500">尚未创建旅程</p>}</div><button className="primary-btn shrink-0" onClick={()=>setCreatingTrip(true)}><Plus size={17}/><span className="hidden sm:inline">新建旅程</span></button></div><div className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">{loading?<div className="py-20 text-center text-stone-400">正在加载旅程…</div>:error?<div className="rounded-xl bg-red-50 p-4 text-red-600">{error}</div>:selectedTrip?<Outlet key={selectedTrip.id}/>:<div className="card mx-auto max-w-xl p-10 text-center"><h1 className="text-2xl font-bold">先创建第一段旅程</h1><p className="mt-3 text-stone-500">旅程是所有国家、地区、城市、日程与预约的最上层。</p><button className="primary-btn mt-6" onClick={()=>setCreatingTrip(true)}><Plus size={17}/>创建旅程</button></div>}</div></main><Modal open={creatingTrip} title="创建新旅程" onClose={()=>setCreatingTrip(false)}><TripForm onSave={createTrip} onCancel={()=>setCreatingTrip(false)}/></Modal></div>
}
