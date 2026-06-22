import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ReservationTypeIcon, StatCard } from '../components/UI'
import type { ReservationType } from '../types'

describe('网页端图标与首页入口',()=>{
  it('每种预约类型都有稳定的 SVG 图标',()=>{
    const types:ReservationType[]=['酒店','车票','机票','景点','餐厅','其他']
    const {container}=render(<>{types.map(type=><ReservationTypeIcon key={type} type={type}/>)}</>)
    for(const type of types)expect(container.querySelector(`svg[data-reservation-icon="${type}"]`)).toBeInTheDocument()
  })

  it('统计卡暴露可访问的对应页面链接',()=>{
    render(<MemoryRouter><StatCard label="待预约" value="3 项" to="/reservations?tab=pending"/></MemoryRouter>)
    expect(screen.getByRole('link',{name:'待预约：3 项'})).toHaveAttribute('href','/reservations?tab=pending')
  })
})
