import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchExchangeRateToCny, normalizeExchangeRate } from '../utils/exchangeRates'

describe('exchange rate helpers', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns 1 for CNY without network', async () => {
    expect(await fetchExchangeRateToCny('CNY')).toEqual({ rate: 1, source: 'same-currency' })
  })

  it('normalizes live exchange rates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ date: '2026-06-29', rate: 6.7971234 }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    expect(await fetchExchangeRateToCny('USD')).toEqual({ rate: 6.797123, source: 'live', date: '2026-06-29' })
  })

  it('requests the rate for the expense date when provided', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ date: '2026-07-02', rate: 9.0247 }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchExchangeRateToCny('GBP', '2026-07-02')).toEqual({ rate: 9.0247, source: 'live', date: '2026-07-02' })
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('?date=2026-07-02')
  })

  it('falls back when network is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await fetchExchangeRateToCny('NOK')).toEqual({ rate: 0.67, source: 'fallback' })
  })

  it('rounds rates consistently', () => {
    expect(normalizeExchangeRate(1.23456789)).toBe(1.234568)
  })
})
