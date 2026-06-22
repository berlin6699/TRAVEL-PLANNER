import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { TripProvider } from './contexts/TripContext'
import './index.css'
import 'leaflet/dist/leaflet.css'

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><TripProvider><App/></TripProvider></BrowserRouter></StrictMode>)
