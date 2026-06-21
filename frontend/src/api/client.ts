import type { City, Destination, Expense, ExportPayload, Inspiration, ItineraryItem, NewItem, Place, Reservation, ReservationAttachment, RouteLeg, Trip } from '../types'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  if (!response.ok) {
    let message = '请求失败，请稍后重试'
    try {
      const body = await response.json()
      message = typeof body.detail === 'string' ? body.detail : body.detail?.[0]?.msg || message
    } catch { /* keep fallback */ }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const resource = <T extends { id: number }>(path: string) => ({
  list: (params?: Record<string, string | number | boolean | null | undefined>) => {
    const query = new URLSearchParams()
    Object.entries(params||{}).forEach(([key,value])=>{if(value!==null&&value!==undefined&&value!=='')query.set(key,String(value))})
    return request<T[]>(`${path}${query.size?`?${query}`:''}`)
  },
  create: (data: NewItem<T>) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: NewItem<T>) => request<T>(`${path}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`${path}/${id}`, { method: 'DELETE' }),
})

export const api = {
  trip: {
    get: () => request<Trip>('/trip'),
    update: (data: Omit<Trip, 'id'>) => request<Trip>('/trip', { method: 'PUT', body: JSON.stringify(data) }),
  },
  trips: resource<Trip>('/trips'),
  destinations: resource<Destination>('/destinations'),
  cities: resource<City>('/cities'),
  itinerary: resource<ItineraryItem>('/itinerary'),
  reservations: resource<Reservation>('/reservations'),
  reservationAttachments: {
    list: (tripId: number) => request<ReservationAttachment[]>(`/reservation-attachments?trip_id=${tripId}`),
    upload: (reservationId: number, file: File) => { const form=new FormData();form.append('file',file);return request<ReservationAttachment>(`/reservations/${reservationId}/attachments`,{method:'POST',body:form}) },
    remove: (id: number) => request<void>(`/reservation-attachments/${id}`,{method:'DELETE'}),
    fileUrl: (id: number) => `${BASE_URL}/reservation-attachments/${id}/file`,
  },
  inspirations: resource<Inspiration>('/inspirations'),
  places: resource<Place>('/places'),
  routeLegs: resource<RouteLeg>('/route-legs'),
  expenses: resource<Expense>('/expenses'),
  export: () => request<ExportPayload>('/export'),
  import: (data: ExportPayload) => request<{ message: string }>('/import', { method: 'POST', body: JSON.stringify(data) }),
  reset: () => request<void>('/reset', { method: 'DELETE' }),
}
