import { Map, MapPin } from 'lucide-react'
import { LinkButton, Modal } from './UI'

export interface MapTarget {
  title: string
  url: string
  query?: string | null
}

function mapQuery(target: MapTarget) {
  try {
    const value = new URL(target.url).searchParams.get('q')
    if (value) return value
  } catch { /* use the readable fallback below */ }
  return target.query || target.title
}

export function MapButton({ target, onOpen }: { target: MapTarget; onOpen: (target: MapTarget) => void }) {
  return <button type="button" onClick={()=>onOpen(target)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral-600 hover:text-coral-700"><MapPin size={15}/>直接看地图</button>
}

export default function MapPreview({ target, onClose }: { target: MapTarget | null; onClose: () => void }) {
  const embedUrl = target ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery(target))}&output=embed` : ''
  return <Modal open={Boolean(target)} title={target?.title||'地图'} onClose={onClose}>
    {target&&<div><div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"><iframe className="h-[52vh] min-h-80 w-full" src={embedUrl} title={`${target.title}地图`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></div><div className="mt-4 flex flex-col gap-3 rounded-xl bg-stone-50 p-4 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2"><Map size={17}/>地图需要联网加载；若嵌入服务不可用，可使用原始链接。</p><LinkButton href={target.url}>外部地图打开</LinkButton></div></div>}
  </Modal>
}

