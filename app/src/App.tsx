import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Inspirations from './pages/Inspirations'
import Itinerary from './pages/Itinerary'
import Places from './pages/Places'
import Reservations from './pages/Reservations'
import Settings from './pages/Settings'
import Checklist from './pages/Checklist'
import PublicGuide from './pages/PublicGuide'
import Today from './pages/Today'

export default function App(){return <Routes><Route element={<Layout/>}><Route index element={<Dashboard/>}/><Route path="today" element={<Today/>}/><Route path="itinerary" element={<Itinerary/>}/><Route path="reservations" element={<Reservations/>}/><Route path="inspirations" element={<Inspirations/>}/><Route path="places" element={<Places/>}/><Route path="checklist" element={<Checklist/>}/><Route path="expenses" element={<Expenses/>}/><Route path="settings" element={<Settings/>}/><Route path="guide" element={<PublicGuide/>}/><Route path="*" element={<div className="card p-10 text-center"><h1 className="text-3xl font-bold">走错路啦</h1><a href="/" className="primary-btn mt-5">返回首页</a></div>}/></Route></Routes>}
