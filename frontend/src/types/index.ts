export type ItineraryType = '交通' | '酒店' | '景点' | '餐饮' | '购物' | '其他'
export type ReservationType = '酒店' | '车票' | '机票' | '景点' | '餐厅' | '其他'
export type ReservationStatus = '已预约' | '待预约' | '已完成' | '已取消'
export type PlatformType = '小红书' | '公众号' | '网页' | '其他'
export type PlaceType = '酒店' | '车站' | '机场' | '景点' | '餐厅' | '商场' | '其他'
export type ExpenseCategory = '交通' | '住宿' | '餐饮' | '门票' | '购物' | '其他'
export type TransportMode = '步行' | '公共交通' | '出租车' | '自驾' | '骑行' | '火车' | '大巴' | '飞机' | '轮渡' | '其他'

export interface Trip {
  id: number; name: string; start_date: string; end_date: string; total_budget: number; currency: string
}
export interface City {
  id: number; trip_id: number; name: string; country: string | null; order_index: number
  arrival_date: string | null; departure_date: string | null; latitude: number | null; longitude: number | null; note: string | null
}
export interface ItineraryItem {
  id: number; title: string; date: string; start_time: string; end_time: string | null; type: ItineraryType
  location: string | null; note: string | null; reservation_id: number | null; place_id: number | null
  map_url: string | null; image_url: string | null; city_id: number | null
}
export interface Reservation {
  id: number; name: string; type: ReservationType; date: string; time: string | null; status: ReservationStatus
  order_number: string | null; location: string | null; note: string | null; booking_url: string | null
  map_url: string | null; image_url: string | null; city_id: number | null
}
export interface Inspiration {
  id: number; title: string; platform: PlatformType; url: string; tags: string[]; related_place: string | null
  note: string | null; image_url: string | null; favorite: boolean
}
export interface Place {
  id: number; name: string; type: PlaceType; city: string | null; address: string | null
  map_url: string | null; note: string | null; image_url: string | null; city_id: number | null
  latitude: number | null; longitude: number | null
}
export interface RouteLeg {
  id: number; title: string; from_place_id: number; to_place_id: number; transport_modes: TransportMode[]
  selected_mode: TransportMode | null; duration_minutes: number | null; reservation_id: number | null
  order_index: number; note: string | null
}
export interface Expense {
  id: number; title: string; amount: number; currency: string; date: string; category: ExpenseCategory; payment_method: string | null
  note: string | null; is_split: boolean; itinerary_id: number | null; reservation_id: number | null
}
export type NewItem<T extends { id: number }> = Omit<T, 'id'>
export interface ExportPayload {
  schema_version: 1; exported_at: string; trip: Trip; itinerary: ItineraryItem[]; reservations: Reservation[]
  inspirations: Inspiration[]; places: Place[]; expenses: Expense[]; cities: City[]; route_legs: RouteLeg[]
}
