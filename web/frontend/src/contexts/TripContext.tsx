import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { Trip } from '../types'

interface TripContextValue {
  trips: Trip[]
  selectedTrip: Trip | null
  selectedTripId: number | null
  loading: boolean
  error: string
  selectTrip: (id: number) => void
  refreshTrips: () => Promise<void>
}

const TripContext=createContext<TripContextValue|null>(null)

export function TripProvider({children}:{children:ReactNode}){
  const [trips,setTrips]=useState<Trip[]>([]),[selectedTripId,setSelectedTripId]=useState<number|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const refreshTrips=async()=>{setLoading(true);setError('');try{const next=await api.trips.list();setTrips(next);const saved=Number(localStorage.getItem('travel-planner-trip-id'));const current=next.find(x=>x.id===selectedTripId)||next.find(x=>x.id===saved)||next[0]||null;setSelectedTripId(current?.id||null);if(current)localStorage.setItem('travel-planner-trip-id',String(current.id));else localStorage.removeItem('travel-planner-trip-id')}catch(e){setError(e instanceof Error?e.message:'旅程加载失败')}finally{setLoading(false)}}
  useEffect(()=>{void refreshTrips()},[])
  const selectTrip=(id:number)=>{setSelectedTripId(id);localStorage.setItem('travel-planner-trip-id',String(id))}
  const selectedTrip=useMemo(()=>trips.find(x=>x.id===selectedTripId)||null,[trips,selectedTripId])
  return <TripContext.Provider value={{trips,selectedTrip,selectedTripId,loading,error,selectTrip,refreshTrips}}>{children}</TripContext.Provider>
}

export function useTrip(){const value=useContext(TripContext);if(!value)throw new Error('useTrip 必须在 TripProvider 内使用');return value}

