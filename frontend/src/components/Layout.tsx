import { useState } from 'react'
import { CalendarDays, Compass, Home, MapPin, Menu, NotebookTabs, ReceiptText, Settings, X } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const nav = [
  ['/', '首页', Home], ['/itinerary', '城市日程', CalendarDays], ['/reservations', '预约', NotebookTabs],
  ['/inspirations', '灵感', Compass], ['/places', '城市与路线', MapPin], ['/expenses', '记账', ReceiptText], ['/settings', '设置', Settings],
] as const

export default function Layout() {
  const [open, setOpen] = useState(false)
  const sidebar = <aside className="flex h-full w-64 flex-col bg-[#292824] px-4 py-6 text-white">
    <div className="mb-8 flex items-center justify-between px-3"><div><div className="text-2xl font-bold">旅途<span className="text-coral-500">.</span></div><div className="mt-1 text-xs text-stone-400">TRAVEL PLANNER</div></div><button className="md:hidden" onClick={()=>setOpen(false)}><X/></button></div>
    <nav className="space-y-1">{nav.map(([to,label,Icon])=><NavLink key={to} end={to==='/'} to={to} onClick={()=>setOpen(false)} className={({isActive})=>`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${isActive?'bg-coral-500 text-white shadow-lg shadow-coral-500/20':'text-stone-300 hover:bg-white/5 hover:text-white'}`}><Icon size={19}/>{label}</NavLink>)}</nav>
    <div className="mt-auto rounded-2xl bg-white/5 p-4 text-xs leading-5 text-stone-400">把期待收进行囊，<br/>把每一天安排得刚刚好。</div>
  </aside>
  return <div className="min-h-screen bg-cream"><div className="fixed inset-y-0 left-0 z-30 hidden md:block">{sidebar}</div>{open&&<div className="fixed inset-0 z-40 md:hidden"><button aria-label="关闭菜单" className="absolute inset-0 bg-black/40" onClick={()=>setOpen(false)}/>{sidebar}</div>}<main className="min-h-screen md:pl-64"><div className="sticky top-0 z-20 flex items-center border-b border-stone-100 bg-cream/90 px-4 py-3 backdrop-blur md:hidden"><button onClick={()=>setOpen(true)} className="rounded-lg p-2"><Menu/></button><span className="ml-2 font-bold">旅途</span></div><div className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10"><Outlet/></div></main></div>
}
