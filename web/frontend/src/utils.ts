export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', weekday: 'short' }) {
  return new Intl.DateTimeFormat('zh-CN', options).format(new Date(`${value}T00:00:00`))
}

export function formatMoney(value: number, currency = 'CNY') {
  try { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value) }
  catch { return `${currency} ${value.toFixed(2)}` }
}

export function todayDateKey(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function tripStatus(start: string, end: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startAt = new Date(`${start}T00:00:00`).getTime()
  const endAt = new Date(`${end}T00:00:00`).getTime()
  const day = 86400000
  if (today < startAt) return { label: `距离出发还有 ${Math.ceil((startAt - today) / day)} 天`, phase: 'before' as const }
  if (today <= endAt) return { label: `旅途中 · 第 ${Math.floor((today - startAt) / day) + 1} 天`, phase: 'during' as const }
  return { label: '旅程已结束', phase: 'after' as const }
}
