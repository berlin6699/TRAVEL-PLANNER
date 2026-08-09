import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ItineraryForm } from '../components/ResourceForms'
import type { ItineraryItem, NewItem, Reservation } from '../types'

const reservations: Reservation[] = [
  {
    id: 7,
    trip_id: 1,
    name: '新干线东京→京都',
    type: '车票',
    date: '2026-08-10',
    time: '09:00',
    status: '已预约',
    order_number: 'TKT-001',
    location: '东京站',
    note: '',
    booking_url: '',
    map_url: '',
    image_url: '',
    city_id: 1,
  },
  {
    id: 8,
    trip_id: 1,
    name: '清水寺门票',
    type: '景点',
    date: '2026-08-11',
    time: null,
    status: '待预约',
    order_number: '',
    location: '',
    note: '',
    booking_url: '',
    map_url: '',
    image_url: '',
    city_id: 2,
  },
]

describe('ItineraryForm 关联预约', () => {
  it('点击预约复选框后可以选中并随表单保存', async () => {
    let saved: NewItem<ItineraryItem> | undefined
    render(
      <ItineraryForm
        item={null}
        onSave={async value => { saved = value }}
        onCancel={() => undefined}
        reservations={reservations}
        inspirations={[]}
        places={[]}
        cities={[]}
        tripId={1}
      />,
    )

    const first = screen.getByRole('checkbox', { name: /新干线东京→京都/ })
    const second = screen.getByRole('checkbox', { name: /清水寺门票/ })
    expect(first).not.toBeChecked()

    fireEvent.click(first)
    expect(first).toBeChecked()
    expect(second).not.toBeChecked()

    fireEvent.click(second)
    expect(first).toBeChecked()
    expect(second).toBeChecked()

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '去京都' } })
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-08-10' } })
    fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '09:00' } })
    fireEvent.click(screen.getByRole('button', { name: /保存/ }))
    await waitFor(() => expect(saved).toBeDefined())
    expect(saved?.reservation_ids).toEqual([7, 8])
    expect(saved?.reservation_id).toBe(7)
  })
})
