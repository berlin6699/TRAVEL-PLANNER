export type ItineraryType = '交通' | '酒店' | '景点' | '餐饮' | '购物' | '其他'
export type ReservationType = '酒店' | '车票' | '机票' | '景点' | '餐厅' | '其他'
export type ReservationStatus = '已预约' | '待预约' | '已完成' | '已取消'
export type PlatformType = '小红书' | '公众号' | '网页' | '其他'
export type PlaceType = '酒店' | '车站' | '机场' | '景点' | '餐厅' | '商场' | '其他'
export type ExpenseCategory = '交通' | '住宿' | '餐饮' | '门票' | '购物' | '其他'
export type TransportMode = '步行' | '公共交通' | '出租车' | '自驾' | '骑行' | '火车' | '大巴' | '飞机' | '轮渡' | '其他'
export type ChecklistKind = '行李' | '待办'

export interface Trip {
  id: number; name: string; start_date: string; end_date: string; total_budget: number; currency: string
}
export interface Destination {
  id: number; trip_id: number; name: string; type: '国家'|'地区'; code: string | null
  order_index: number; parent_id: number | null; note: string | null
}
export interface City {
  id: number; trip_id: number; destination_id: number | null; name: string; country: string | null; order_index: number
  arrival_date: string | null; departure_date: string | null; latitude: number | null; longitude: number | null; note: string | null
}
export interface ItineraryItem {
  id: number; trip_id: number; title: string; date: string; start_time: string; end_time: string | null; type: ItineraryType
  location: string | null; note: string | null; reservation_id: number | null; reservation_ids?: number[]; inspiration_id?: number | null; place_id: number | null
  map_url: string | null; image_url: string | null; city_id: number | null; reminder_minutes?: number | null
}
export interface Reservation {
  id: number; trip_id: number; name: string; type: ReservationType; date: string; time: string | null; status: ReservationStatus
  order_number: string | null; location: string | null; note: string | null; booking_url: string | null
  map_url: string | null; image_url: string | null; city_id: number | null
}
export interface ReservationAttachment {
  id: number; reservation_id: number; original_name: string; mime_type: string
  size_bytes: number; uploaded_at: string
}
export interface Inspiration {
  id: number; trip_id: number; title: string; platform: PlatformType; url: string; tags: string[]; related_place: string | null
  note: string | null; image_url: string | null; favorite: boolean
}
export interface Place {
  id: number; trip_id: number; name: string; type: PlaceType; city: string | null; address: string | null
  map_url: string | null; note: string | null; image_url: string | null; city_id: number | null
  latitude: number | null; longitude: number | null
}
export interface RouteLeg {
  id: number; trip_id: number; title: string; from_place_id: number; to_place_id: number; transport_modes: TransportMode[]
  selected_mode: TransportMode | null; duration_minutes: number | null; reservation_id: number | null
  order_index: number; note: string | null
}
export interface Expense {
  id: number; trip_id: number; title: string; amount: number; currency: string; date: string; category: ExpenseCategory; payment_method: string | null
  original_amount: number | null; original_currency: string | null; exchange_rate: number | null
  note: string | null; is_split: boolean; itinerary_id: number | null; reservation_id: number | null
}
export interface ChecklistItem {
  id: number; trip_id: number; kind: ChecklistKind; title: string; category: string | null; quantity: number
  completed: boolean; due_date: string | null; note: string | null; order_index: number
}
export interface GeocodeResult {
  name: string; display_name: string; latitude: number; longitude: number; result_type: string | null
}
export type NewItem<T extends { id: number }> = Omit<T, 'id'>
export interface ExportPayload {
  schema_version: 1; exported_at: string; trip: Trip; itinerary: ItineraryItem[]; reservations: Reservation[]
  inspirations: Inspiration[]; places: Place[]; expenses: Expense[]; cities: City[]; route_legs: RouteLeg[]
  trips: Trip[]; destinations: Destination[]
  checklist: ChecklistItem[]
}
