import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Reservations from '../pages/Reservations'

vi.mock('../contexts/TripContext', () => ({
  useTrip: () => ({
    selectedTrip: { id: 1, name: '测试旅程', start_date: '2026-08-01', end_date: '2026-08-10', total_budget: 0, currency: 'CNY' },
  }),
}))

const data = {
  reservations: [
    {
      id: 8,
      trip_id: 1,
      name: '清水寺门票',
      type: '景点',
      date: '2026-08-11',
      time: null,
      status: '待预约',
      order_number: null,
      location: '',
      note: '',
      booking_url: null,
      map_url: null,
      image_url: null,
      city_id: 2,
    },
    {
      id: 9,
      trip_id: 1,
      name: '京都酒店',
      type: '酒店',
      date: '2026-08-10',
      time: null,
      status: '已预约',
      order_number: null,
      location: '',
      note: '',
      booking_url: null,
      map_url: null,
      image_url: null,
      city_id: 1,
    },
  ],
  cities: [
    { id: 1, trip_id: 1, name: '东京', country: '日本', order_index: 0, arrival_date: null, departure_date: null, latitude: null, longitude: null, note: null },
    { id: 2, trip_id: 1, name: '京都', country: '日本', order_index: 1, arrival_date: null, departure_date: null, latitude: null, longitude: null, note: null },
  ],
  places: [],
  attachments: [],
}

vi.mock('../hooks/useLoad', () => ({
  useLoad: () => ({ data, loading: false, error: '', reload: vi.fn(async () => undefined) }),
}))

describe('预约页从日程跳转聚焦', () => {
  it('带 ?id= 与 &files=1 打开时，即使目标预约在“待预约”也会显示出来并打开附件面板', () => {
    render(
      <MemoryRouter initialEntries={['/reservations?id=8&files=1']}>
        <Reservations/>
      </MemoryRouter>,
    )
    expect(screen.getByText('清水寺门票')).toBeInTheDocument()
    expect(screen.getByText('清水寺门票 · PDF 附件')).toBeInTheDocument()
    expect(screen.getByText(/还没有上传 PDF 附件/)).toBeInTheDocument()
  })
})
