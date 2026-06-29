import { describe, expect, it } from 'vitest'
import { formatMoney, todayDateKey, tripStatus } from '../utils'

describe('travel utilities',()=>{
  it('calculates countdown phases',()=>{
    expect(tripStatus('2026-07-01','2026-07-08',new Date('2026-06-21T12:00:00')).label).toBe('距离出发还有 10 天')
    expect(tripStatus('2026-06-20','2026-06-25',new Date('2026-06-21T12:00:00')).phase).toBe('during')
    expect(tripStatus('2026-06-01','2026-06-08',new Date('2026-06-21T12:00:00')).label).toBe('旅程已结束')
  })
  it('formats configured currency',()=>{expect(formatMoney(100,'CNY')).toContain('100')})
  it('creates local calendar date keys',()=>{expect(todayDateKey(new Date(2026,5,9,23,30))).toBe('2026-06-09')})
})
