import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'

const Dashboard=lazy(()=>import('./pages/Dashboard'))
const Expenses=lazy(()=>import('./pages/Expenses'))
const Inspirations=lazy(()=>import('./pages/Inspirations'))
const Itinerary=lazy(()=>import('./pages/Itinerary'))
const Places=lazy(()=>import('./pages/Places'))
const Reservations=lazy(()=>import('./pages/Reservations'))
const Settings=lazy(()=>import('./pages/Settings'))
const Checklist=lazy(()=>import('./pages/Checklist'))
const PublicGuide=lazy(()=>import('./pages/PublicGuide'))
const Today=lazy(()=>import('./pages/Today'))

export default function App(){return <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-stone-400">页面加载中…</div>}><Routes><Route element={<Layout/>}><Route index element={<Dashboard/>}/><Route path="today" element={<Today/>}/><Route path="itinerary" element={<Itinerary/>}/><Route path="reservations" element={<Reservations/>}/><Route path="inspirations" element={<Inspirations/>}/><Route path="places" element={<Places/>}/><Route path="checklist" element={<Checklist/>}/><Route path="expenses" element={<Expenses/>}/><Route path="settings" element={<Settings/>}/><Route path="guide" element={<PublicGuide/>}/><Route path="*" element={<div className="card p-10 text-center"><h1 className="text-3xl font-bold">走错路啦</h1><a href="./" className="primary-btn mt-5">返回首页</a></div>}/></Route></Routes></Suspense>}
