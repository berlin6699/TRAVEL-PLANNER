import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { Copy, DatabaseBackup, Download, FolderOpen, HardDrive, Info, RotateCcw, Save, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { ErrorBanner, FormInput, FormSelect, Loading, PageHeader } from '../components/UI'
import { useTrip } from '../contexts/TripContext'
import type { ExportPayload, Trip } from '../types'

const currencies = [
  ['CNY', '人民币'],
  ['USD', '美元'],
  ['EUR', '欧元'],
  ['GBP', '英镑'],
  ['JPY', '日元'],
  ['HKD', '港币'],
  ['KRW', '韩元'],
  ['THB', '泰铢'],
  ['SGD', '新加坡元'],
  ['AUD', '澳元'],
  ['CAD', '加元'],
  ['CHF', '瑞士法郎'],
]

function platformName(value: string) {
  if (value === 'darwin') return 'macOS'
  if (value === 'win32') return 'Windows'
  return value
}

export default function Settings() {
  const navigate = useNavigate()
  const { selectedTrip, refreshTrips, trips } = useTrip()
  const data = selectedTrip!
  const loading = false
  const error = ''
  const [form, setForm] = useState<Omit<Trip, 'id'> | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [desktopInfo, setDesktopInfo] = useState<DesktopDataLocation | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        total_budget: Number(data.total_budget),
        currency: data.currency,
      })
    }
  }, [data])

  useEffect(() => {
    void window.travelPlannerDesktop?.getDataLocation().then(setDesktopInfo).catch(() => setDesktopInfo(null))
  }, [])

  const notice = (value: string) => {
    setMessage(value)
    setActionError('')
    setTimeout(() => setMessage(''), 3000)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setActionError('')
    try {
      await api.trips.update(data.id, form)
      notice('旅程设置已保存')
      await refreshTrips()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const exportData = async () => {
    try {
      const blob = await api.exportArchive()
      const filename = `travel-planner-full-${new Date().toISOString().slice(0, 10)}.zip`
      if (Capacitor.isNativePlatform()) {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let binary = ''
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        const file = await Filesystem.writeFile({ path: filename, data: btoa(binary), directory: Directory.Cache })
        await Share.share({ title: '旅途完整备份', text: '包含全部旅行数据和预约 PDF', url: file.uri, dialogTitle: '保存或分享旅行备份' })
      } else {
        const href = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = href
        a.download = filename
        a.click()
        URL.revokeObjectURL(href)
      }
      notice('完整备份已导出，包含所有 PDF')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '导出失败')
    }
  }

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      if (!confirm('导入会替换当前全部旅程、数据和 PDF，确定继续吗？')) return
      if (file.name.toLowerCase().endsWith('.zip')) {
        if (file.size > 250 * 1024 * 1024) throw new Error('ZIP 备份不能超过 250 MB')
        await api.importArchive(file)
      } else {
        const payload = JSON.parse(await file.text()) as ExportPayload
        await api.import(payload)
      }
      notice('数据与 PDF 恢复成功')
      await refreshTrips()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '文件无效或导入失败')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const reset = async () => {
    if (!confirm('将清空全部旅程、日程、预约、灵感、地点和消费。确定继续吗？')) return
    if (!confirm('此操作无法撤销。再次确认清空本地数据？')) return
    try {
      await api.reset()
      notice('本地数据已清空')
      await refreshTrips()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '清空失败')
    }
  }

  const removeTrip = async () => {
    if (trips.length <= 1) {
      setActionError('至少保留一个旅程；可以新建旅程后再删除当前旅程。')
      return
    }
    if (!confirm(`确定删除旅程“${data.name}”及其全部国家、城市、日程和预约吗？`)) return
    try {
      await api.trips.remove(data.id)
      await refreshTrips()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除旅程失败')
    }
  }

  const copyDataPath = async () => {
    if (!desktopInfo) return
    try {
      await navigator.clipboard.writeText(desktopInfo.dataPath)
      notice('本机数据路径已复制')
    } catch {
      setActionError('复制失败，可以手动选中路径复制')
    }
  }

  const openDataPath = async () => {
    try {
      const result = await window.travelPlannerDesktop?.openDataLocation()
      if (!result?.success) throw new Error(result?.message || '无法打开数据文件夹')
      notice('已打开本机数据文件夹')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '无法打开数据文件夹')
    }
  }

  if (loading) return <Loading />
  if (!form) return <ErrorBanner message={error} />

  return (
    <div>
      <PageHeader title="设置" description="调整旅行基本信息，也照看好你的本地数据。" action="导出公开攻略" onAction={() => navigate('/guide')} />
      <ErrorBanner message={error || actionError} />
      {message && <div className="mb-5 rounded-xl border border-mint-100 bg-mint-50 px-4 py-3 text-sm font-semibold text-mint-600">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-6 lg:col-span-3">
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-xl bg-coral-50 p-2.5 text-coral-500"><Save size={20} /></span>
            <div>
              <h2 className="font-bold">旅行设置</h2>
              <p className="text-xs text-stone-400">首页和预算统计会使用这些信息</p>
            </div>
          </div>
          <form onSubmit={save}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormInput required label="旅行名称" placeholder="例如：日本关西 8 日游" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <FormInput required type="date" label="开始日期" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              <FormInput required type="date" label="结束日期" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              <FormInput required type="number" min="0" step="0.01" label="总预算" value={form.total_budget} onChange={e => setForm({ ...form, total_budget: Number(e.target.value) })} />
              <FormSelect label="预算货币" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                {currencies.map(([value, label]) => <option key={value} value={value}>{label} · {value}</option>)}
              </FormSelect>
            </div>
            <button className="primary-btn mt-6" disabled={saving}>{saving ? '保存中…' : '保存设置'}</button>
          </form>
        </section>

        <section className="card p-6 lg:col-span-2">
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-xl bg-mint-50 p-2.5 text-mint-600"><DatabaseBackup size={20} /></span>
            <div>
              <h2 className="font-bold">数据管理</h2>
              <p className="text-xs text-stone-400">备份、恢复或重新开始</p>
            </div>
          </div>
          <div className="space-y-3">
            <button onClick={() => void exportData()} className="flex w-full items-center gap-3 rounded-2xl border border-stone-100 p-4 text-left transition hover:bg-stone-50">
              <Download className="text-skysoft-500" />
              <span><b className="block text-sm">导出完整备份 ZIP</b><small className="text-stone-400">包含全部旅程数据和预约 PDF</small></span>
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 rounded-2xl border border-stone-100 p-4 text-left transition hover:bg-stone-50">
              <Upload className="text-mint-600" />
              <span><b className="block text-sm">导入备份恢复</b><small className="text-stone-400">支持完整 ZIP 或旧版 JSON</small></span>
            </button>
            <input ref={fileRef} className="hidden" type="file" accept="application/zip,.zip,application/json,.json" onChange={e => void importFile(e.target.files?.[0])} />
            <button onClick={() => void removeTrip()} className="flex w-full items-center gap-3 rounded-2xl border border-amber-100 p-4 text-left text-amber-700 transition hover:bg-amber-50">
              <RotateCcw />
              <span><b className="block text-sm">删除当前旅程</b><small className="text-amber-600">只删除“{data.name}”及其下属内容</small></span>
            </button>
            <button onClick={() => void reset()} className="flex w-full items-center gap-3 rounded-2xl border border-red-100 p-4 text-left text-red-600 transition hover:bg-red-50">
              <RotateCcw />
              <span><b className="block text-sm">清空全部数据库</b><small className="text-red-400">删除所有旅程，需要两次确认</small></span>
            </button>
          </div>
          <p className="mt-5 rounded-xl bg-stone-50 p-3 text-xs leading-5 text-stone-400">完整 ZIP 会一起备份 PDF。建议旅程有重要修改后及时导出。</p>
        </section>

        <section className="card p-6 lg:col-span-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-skysoft-50 p-2.5 text-sky-600"><Info size={20} /></span>
              <div>
                <h2 className="font-bold">应用信息</h2>
                <p className="text-xs text-stone-400">用于确认当前安装的 App 版本</p>
              </div>
            </div>
            <div className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 text-sm">
              <span className="mr-3 text-stone-400">当前版本</span>
              <span className="font-extrabold text-stone-900">v{__APP_VERSION__}</span>
            </div>
          </div>
        </section>

        {desktopInfo && (
          <section className="card overflow-hidden lg:col-span-5">
            <div className="border-b border-stone-100 bg-gradient-to-r from-stone-900 via-stone-800 to-coral-900 p-6 text-white">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="rounded-2xl bg-white/12 p-3 text-mint-100 shadow-inner shadow-white/10"><HardDrive size={22} /></span>
                  <div>
                    <h2 className="text-lg font-extrabold">本机数据位置</h2>
                    <p className="mt-1 text-sm leading-6 text-white/70">桌面版数据保存在这台 {platformName(desktopInfo.platform)} 电脑，不会自动上传到云端。</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void copyDataPath()} className="secondary-btn border-white/25 bg-white/10 text-white hover:bg-white/20"><Copy size={16} />复制路径</button>
                  <button onClick={() => void openDataPath()} className="secondary-btn border-white/25 bg-white text-stone-900 hover:bg-white/90"><FolderOpen size={16} />打开文件夹</button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">应用数据目录</p>
                <p className="break-all rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 font-mono text-xs leading-6 text-stone-600">{desktopInfo.dataPath}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">IndexedDB 数据库目录</p>
                <p className="break-all rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 font-mono text-xs leading-6 text-stone-600">{desktopInfo.indexedDbPath}</p>
              </div>
            </div>
            <p className="px-6 pb-6 text-xs leading-6 text-stone-400">提示：预约 PDF、旅程、行程、清单和预算等都保存在 Electron 的本地用户数据目录中；迁移电脑时，优先使用“导出完整备份 ZIP”。</p>
          </section>
        )}
      </div>
    </div>
  )
}
