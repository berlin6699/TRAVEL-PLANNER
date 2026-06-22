import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { TripProvider } from './contexts/TripContext'
import './index.css'
import 'leaflet/dist/leaflet.css'

createRoot(document.getElementById('root')!).render(<StrictMode><HashRouter><TripProvider><App/></TripProvider></HashRouter></StrictMode>)
