export type ExchangeRateSource = 'same-currency' | 'live' | 'fallback'

export interface ExchangeRateResult {
  rate: number
  source: ExchangeRateSource
  date?: string
}

export const fallbackRatesToCny: Record<string, number> = {
  CNY: 1,
  USD: 6.8,
  EUR: 7.95,
  GBP: 9.3,
  JPY: 0.047,
  HKD: 0.87,
  TWD: 0.23,
  KRW: 0.005,
  THB: 0.21,
  SGD: 5.3,
  MYR: 1.6,
  IDR: 0.00042,
  VND: 0.00026,
  PHP: 0.12,
  INR: 0.079,
  AUD: 4.5,
  NZD: 4.1,
  CAD: 5,
  CHF: 8.4,
  NOK: 0.67,
  SEK: 0.72,
  DKK: 1.07,
  ISK: 0.056,
  PLN: 1.88,
  CZK: 0.33,
  HUF: 0.02,
  RON: 1.57,
  TRY: 0.17,
  AED: 1.85,
  SAR: 1.81,
  QAR: 1.87,
  ILS: 2.02,
  EGP: 0.14,
  MAD: 0.74,
  ZAR: 0.38,
  BRL: 1.24,
  MXN: 0.36,
  ARS: 0.005,
  CLP: 0.0072,
  COP: 0.0017,
}

export function normalizeExchangeRate(value: number) {
  return Number(value.toFixed(6))
}

function normalizeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

export async function fetchExchangeRateToCny(currency: string, date?: string): Promise<ExchangeRateResult> {
  const code = currency.toUpperCase()
  const rateDate = normalizeDate(date)
  if (code === 'CNY') return { rate: 1, source: 'same-currency', ...(rateDate ? { date: rateDate } : {}) }

  try {
    const query = rateDate ? `?date=${encodeURIComponent(rateDate)}` : ''
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(code)}/CNY${query}`, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Exchange rate request failed: ${response.status}`)
    const body = await response.json() as { rate?: number; date?: string }
    if (typeof body.rate === 'number' && Number.isFinite(body.rate) && body.rate > 0) {
      return { rate: normalizeExchangeRate(body.rate), source: 'live', date: body.date }
    }
  } catch {
    // Use the local table below when the device is offline or the API does not support a currency.
  }

  const fallback = fallbackRatesToCny[code]
  if (fallback) return { rate: fallback, source: 'fallback', ...(rateDate ? { date: rateDate } : {}) }
  throw new Error(`没有找到 ${code} 到 CNY 的汇率`)
}
