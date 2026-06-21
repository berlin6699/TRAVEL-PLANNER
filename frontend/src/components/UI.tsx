import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { ExternalLink, Inbox, LoaderCircle, Plus, X } from 'lucide-react'

export function PageHeader({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 className="text-3xl font-bold tracking-tight text-stone-900">{title}</h1><p className="mt-2 text-stone-500">{description}</p></div>
    {action && <button className="primary-btn" onClick={onAction}><Plus size={18} />{action}</button>}
  </div>
}

export function StatCard({ label, value, note, icon }: { label: string; value: ReactNode; note?: string; icon?: ReactNode }) {
  return <div className="card p-5"><div className="flex items-center justify-between text-stone-500"><span className="text-sm font-medium">{label}</span><span className="text-coral-500">{icon}</span></div><div className="mt-3 text-2xl font-bold text-stone-900">{value}</div>{note && <p className="mt-1 text-xs text-stone-400">{note}</p>}</div>
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <div role="dialog" aria-modal="true" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl" onMouseDown={e => e.stopPropagation()}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white/95 px-6 py-5 backdrop-blur"><h2 className="text-xl font-bold">{title}</h2><button aria-label="关闭" onClick={onClose} className="rounded-full p-2 hover:bg-stone-100"><X size={20}/></button></div>
      <div className="p-6">{children}</div>
    </div>
  </div>
}

const fieldClass = 'mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-coral-500 focus:ring-4 focus:ring-coral-100'
export function FormInput({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="block text-sm font-medium text-stone-700">{label}<input className={fieldClass} {...props}/></label> }
export function FormSelect({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) { return <label className="block text-sm font-medium text-stone-700">{label}<select className={fieldClass} {...props}>{children}</select></label> }
export function FormTextarea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) { return <label className="block text-sm font-medium text-stone-700">{label}<textarea className={`${fieldClass} min-h-24 resize-y`} {...props}/></label> }

export function FormActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) { return <div className="mt-6 flex justify-end gap-3"><button type="button" className="secondary-btn" onClick={onCancel}>取消</button><button className="primary-btn" disabled={saving}>{saving && <LoaderCircle className="animate-spin" size={17}/>}保存</button></div> }
export function ErrorBanner({ message }: { message: string }) { return message ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div> : null }
export function Loading() { return <div className="flex min-h-64 items-center justify-center text-stone-400"><LoaderCircle className="mr-2 animate-spin"/>正在加载…</div> }
export function EmptyState({ title, message, action, onAction }: { title: string; message: string; action?: string; onAction?: () => void }) { return <div className="card flex min-h-64 flex-col items-center justify-center p-8 text-center"><div className="rounded-full bg-coral-50 p-4 text-coral-500"><Inbox/></div><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 max-w-sm text-sm text-stone-500">{message}</p>{action && <button className="primary-btn mt-5" onClick={onAction}><Plus size={17}/>{action}</button>}</div> }
export function Badge({ children, tone = 'coral' }: { children: ReactNode; tone?: 'coral'|'mint'|'sky'|'stone' }) { const styles={coral:'bg-coral-50 text-coral-700',mint:'bg-mint-50 text-mint-600',sky:'bg-skysoft-50 text-sky-700',stone:'bg-stone-100 text-stone-600'}; return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span> }
export function LinkButton({ href, children }: { href: string; children: ReactNode }) { return <a className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral-600 hover:text-coral-700" href={href} target="_blank" rel="noreferrer">{children}<ExternalLink size={14}/></a> }
export function ImageCover({ src, label }: { src?: string | null; label: string }) { return <div className="relative h-40 overflow-hidden bg-gradient-to-br from-coral-100 via-amber-50 to-mint-100">{src ? <img src={src} alt="" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display='none' }}/> : null}<span className="absolute bottom-3 left-3 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-stone-700 backdrop-blur">{label}</span></div> }
export function IconButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700" {...props}>{children}</button> }
