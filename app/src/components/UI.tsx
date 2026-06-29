import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, BedDouble, Check, CircleHelp, ExternalLink, Inbox, Landmark, LoaderCircle, MapPin, Plane, Plus, Sparkles, TrainFront, UtensilsCrossed, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReservationType } from '../types'

export function PageHeader({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="page-heading mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="relative z-10"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-coral-600"><span className="h-1.5 w-7 rounded-full bg-gradient-to-r from-coral-500 to-amber-300"/>Travel workspace</div><h1 className="text-3xl font-extrabold tracking-[-.03em] text-stone-900 sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl leading-7 text-stone-500">{description}</p></div>
    {action && <button className="primary-btn relative z-10" onClick={onAction}><Plus size={18} />{action}</button>}
  </div>
}

export function StatCard({ label, value, note, icon, to }: { label: string; value: ReactNode; note?: string; icon?: ReactNode; to?: string }) {
  const content=<><div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-coral-50 opacity-0 blur-2xl transition group-hover:opacity-100"/><div className="relative flex items-center justify-between text-stone-500"><span className="text-sm font-semibold">{label}</span><span className="icon-shell flex h-9 w-9 items-center justify-center rounded-xl bg-coral-50 text-coral-500 transition group-hover:scale-105 group-hover:bg-coral-500 group-hover:text-white">{icon}</span></div><div className="relative mt-3 pr-6 text-2xl font-extrabold tracking-tight text-stone-900">{value}</div>{note&&<p className="relative mt-1.5 text-xs leading-5 text-stone-400">{note}</p>}{to&&<ArrowUpRight className="absolute bottom-5 right-5 text-stone-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-coral-500" size={17}/>}</>
  return to?<Link to={to} aria-label={`${label}：${String(value)}`} className="card stat-card interactive-card pressable-card group relative block overflow-hidden p-5">{content}</Link>:<div className="card stat-card interactive-card group relative overflow-hidden p-5">{content}</div>
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[open])
  if (!open) return null
  return createPortal(<div className="modal-backdrop fixed inset-0 z-[1200] overflow-hidden bg-stone-950/45 backdrop-blur-md">
    <div className="flex h-[100dvh] items-end justify-center sm:items-center sm:p-4" onMouseDown={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} className="modal-panel flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-white/80 bg-white/95 shadow-[0_30px_90px_-20px_rgba(28,25,23,.45)] backdrop-blur-xl sm:max-h-[92dvh] sm:rounded-[2rem]" onMouseDown={e => e.stopPropagation()}>
      <div className="z-10 flex shrink-0 items-center justify-between border-b border-stone-100/80 bg-white/95 px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5"><div className="min-w-0"><p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-coral-500"><Sparkles size={11}/>Travel planner</p><h2 className="truncate text-xl font-bold">{title}</h2></div><button aria-label="关闭" onClick={onClose} className="ml-3 shrink-0 rounded-full border border-stone-100 bg-white p-2 text-stone-500 shadow-sm transition hover:rotate-90 hover:bg-stone-100"><X size={20}/></button></div>
      <div className="modal-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">{children}</div>
    </div>
    </div>
  </div>,document.body)
}

const fieldClass = 'mt-1.5 w-full rounded-xl border border-stone-200/90 bg-stone-50/60 px-3.5 py-2.5 text-sm shadow-inner shadow-stone-100/50 outline-none transition focus:border-coral-400 focus:bg-white focus:ring-4 focus:ring-coral-100'
export function FormInput({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="block text-sm font-medium text-stone-700">{label}<input className={fieldClass} {...props}/></label> }
export function FormSelect({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) { return <label className="block text-sm font-medium text-stone-700">{label}<select className={fieldClass} {...props}>{children}</select></label> }
export function FormTextarea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) { return <label className="block text-sm font-medium text-stone-700">{label}<textarea className={`${fieldClass} min-h-24 resize-y`} {...props}/></label> }
type FormCheckboxTone = 'coral' | 'mint' | 'sky' | 'stone'
export function FormCheckbox({ label, description, checked, onChange, tone='coral', className='' }: { label: ReactNode; description?: ReactNode; checked: boolean; onChange: (checked: boolean) => void; tone?: FormCheckboxTone; className?: string }) {
  const cardStyles: Record<FormCheckboxTone, string> = {
    coral: checked ? 'border-coral-200 bg-coral-50/90 text-coral-800 shadow-sm shadow-coral-100/50' : 'border-stone-200/80 bg-white/80 text-stone-600 hover:border-coral-200 hover:bg-coral-50/45',
    mint: checked ? 'border-mint-200 bg-mint-50/90 text-mint-700 shadow-sm shadow-mint-100/50' : 'border-stone-200/80 bg-white/80 text-stone-600 hover:border-mint-200 hover:bg-mint-50/45',
    sky: checked ? 'border-skysoft-200 bg-skysoft-50/90 text-sky-700 shadow-sm shadow-skysoft-100/50' : 'border-stone-200/80 bg-white/80 text-stone-600 hover:border-skysoft-200 hover:bg-skysoft-50/45',
    stone: checked ? 'border-stone-300 bg-stone-100 text-stone-800 shadow-sm shadow-stone-100/50' : 'border-stone-200/80 bg-white/80 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
  }
  const markStyles: Record<FormCheckboxTone, string> = {
    coral: 'border-coral-500 bg-coral-500 text-white shadow-sm shadow-coral-200',
    mint: 'border-mint-500 bg-mint-500 text-white shadow-sm shadow-mint-200',
    sky: 'border-sky-500 bg-sky-500 text-white shadow-sm shadow-sky-200',
    stone: 'border-stone-600 bg-stone-700 text-white shadow-sm shadow-stone-200'
  }
  const focusStyles: Record<FormCheckboxTone, string> = { coral: 'focus-within:ring-coral-100', mint: 'focus-within:ring-mint-100', sky: 'focus-within:ring-skysoft-100', stone: 'focus-within:ring-stone-100' }
  return <label className={`group flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 text-sm transition duration-300 focus-within:ring-4 ${focusStyles[tone]} ${cardStyles[tone]} ${className}`}>
    <input type="checkbox" className="sr-only" checked={checked} onChange={event=>onChange(event.target.checked)}/>
    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition duration-300 ${checked ? markStyles[tone] : 'border-stone-300 bg-white text-transparent group-hover:border-stone-400'}`}><Check size={13} strokeWidth={3}/></span>
    <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span>{description&&<span className="mt-0.5 block text-xs leading-5 text-stone-400">{description}</span>}</span>
  </label>
}

export function FormActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) { return <div className="mt-6 flex justify-end gap-3"><button type="button" className="secondary-btn" onClick={onCancel}>取消</button><button className="primary-btn" disabled={saving}>{saving && <LoaderCircle className="animate-spin" size={17}/>}保存</button></div> }
export function ErrorBanner({ message }: { message: string }) { return message ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div> : null }
export function Loading() { return <div className="flex min-h-64 items-center justify-center text-stone-400"><span className="mr-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-coral-500 shadow-card"><LoaderCircle className="animate-spin" size={20}/></span>正在加载…</div> }
export function EmptyState({ title, message, action, onAction }: { title: string; message: string; action?: string; onAction?: () => void }) { return <div className="empty-state relative flex min-h-64 flex-col items-center justify-center overflow-hidden p-8 text-center"><div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-coral-50/70 to-transparent"/><div className="relative rounded-2xl border border-coral-100 bg-white p-4 text-coral-500 shadow-md shadow-coral-100/40"><Inbox/></div><h3 className="relative mt-4 text-lg font-bold">{title}</h3><p className="relative mt-1 max-w-sm text-sm leading-6 text-stone-500">{message}</p>{action && <button className="primary-btn relative mt-5" onClick={onAction}><Plus size={17}/>{action}</button>}</div> }
export function Badge({ children, tone = 'coral' }: { children: ReactNode; tone?: 'coral'|'mint'|'sky'|'stone' }) { const styles={coral:'border-coral-100 bg-coral-50 text-coral-700',mint:'border-mint-100 bg-mint-50 text-mint-600',sky:'border-skysoft-100 bg-skysoft-50 text-sky-700',stone:'border-stone-200/70 bg-stone-100 text-stone-600'}; return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span> }
export function LinkButton({ href, children }: { href: string; children: ReactNode }) { return <a className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral-600 hover:text-coral-700" href={href} target="_blank" rel="noreferrer">{children}<ExternalLink size={14}/></a> }
export function ReservationTypeIcon({ type, size=22 }: { type:ReservationType; size?:number }) { const icons:Record<ReservationType,typeof BedDouble>={酒店:BedDouble,车票:TrainFront,机票:Plane,景点:Landmark,餐厅:UtensilsCrossed,其他:CircleHelp};const Icon=icons[type];return <Icon data-reservation-icon={type} aria-hidden="true" size={size}/> }
export function ImageCover({ src, label, icon, tone='coral' }: { src?: string | null; label: string; icon?:ReactNode; tone?:'coral'|'mint'|'sky'|'stone' }) { const gradients={coral:'from-coral-100 via-[#fff4dc] to-amber-100',mint:'from-mint-100 via-[#effcf7] to-skysoft-100',sky:'from-skysoft-100 via-[#f3f8ff] to-mint-100',stone:'from-stone-200 via-stone-100 to-amber-50'};return <div className={`relative h-40 overflow-hidden bg-gradient-to-br ${gradients[tone]}`}><div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-white/20"/><div className="absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-white/20 blur-xl"/>{src ? <img src={src} alt="" className="relative h-full w-full object-cover transition duration-700 hover:scale-105" onError={e => { e.currentTarget.style.display='none' }}/> : <div className="absolute inset-0 flex items-center justify-center text-white/90"><span className="icon-float icon-shell flex h-14 w-14 items-center justify-center rounded-2xl border border-white/50 bg-white/25 shadow-lg backdrop-blur">{icon||<MapPin size={25}/>}</span></div>}<span className="absolute bottom-3 left-3 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-stone-700 shadow-sm backdrop-blur-md">{label}</span></div> }
export function IconButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className="rounded-xl p-2 text-stone-400 transition duration-300 hover:-translate-y-0.5 hover:bg-stone-100 hover:text-stone-700" {...props}>{children}</button> }
