import { useEffect, useState } from 'react'
import { Edit3, PieChart, Trash2, WalletCards } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { DocumentExportActions } from '../components/DocumentExportActions'
import { ExpenseForm } from '../components/ResourceForms'
import { Badge, EmptyState, ErrorBanner, IconButton, Loading, Modal, PageHeader, StatCard } from '../components/UI'
import { useLoad } from '../hooks/useLoad'
import { useTrip } from '../contexts/TripContext'
import type { Expense, ExpenseCategory, NewItem } from '../types'
import { formatDate, formatMoney } from '../utils'

export default function Expenses(){
  const {selectedTrip}=useTrip();const trip=selectedTrip!;const tripId=trip.id
  const {data,loading,error,reload}=useLoad(async()=>{const expenses=await api.expenses.list({trip_id:tripId});return {trip,expenses}})
  const [filter,setFilter]=useState('全部'),[editing,setEditing]=useState<Expense|null|undefined>(undefined),[params,setParams]=useSearchParams()
  useEffect(()=>{if(params.get('new')==='1'){setEditing(null);setParams({}, {replace:true})}},[params,setParams])
  if(loading)return <Loading/>;if(!data)return <ErrorBanner message={error}/>
  const items=data.expenses.filter(item=>filter==='全部'||item.category===filter),baseExpenses=data.expenses,spent=baseExpenses.reduce((sum,item)=>sum+Number(item.amount),0),budget=Number(data.trip.total_budget),remaining=budget-spent,percent=budget?Math.min(100,spent/budget*100):0
  const cats:('全部'|ExpenseCategory)[]=['全部','交通','住宿','餐饮','门票','购物','其他']
  const categoryTotals=Object.fromEntries(cats.slice(1).map(category=>[category,baseExpenses.filter(item=>item.category===category).reduce((sum,item)=>sum+Number(item.amount),0)]))
  const groups=items.reduce<Record<string,Expense[]>>((result,item)=>{(result[item.date]??=[]).push(item);return result},{})
  const save=async(value:NewItem<Expense>)=>{const payload={...value,itinerary_id:null,reservation_id:null};editing?await api.expenses.update(editing.id,payload):await api.expenses.create(payload);setEditing(undefined);await reload()}
  const remove=async(item:Expense)=>{if(confirm(`确定删除“${item.title}”吗？`)){await api.expenses.remove(item.id);await reload()}}
  const exportTable={title:`${data.trip.name} · 花销清单`,description:`${filter==='全部'?'全部分类':`分类：${filter}`} · 当前筛选结果`,columns:[{label:'日期'},{label:'消费项目'},{label:'分类'},{label:'原币金额'},{label:'折合人民币'},{label:'支付方式'},{label:'备注'}],rows:items.map(item=>[item.date,item.title,item.category,item.original_currency&&item.original_currency!=='CNY'&&item.original_amount?`${formatMoney(Number(item.original_amount),item.original_currency)} × ${item.exchange_rate||'—'}`:formatMoney(Number(item.amount),'CNY'),formatMoney(Number(item.amount),'CNY'),item.payment_method||'—',item.note||'—'])}
  return <div><PageHeader title="旅行记账" description="知道钱花去了哪里，也不让数字偷走旅行的快乐。" action="记一笔" onAction={()=>setEditing(null)}/><ErrorBanner message={error}/>
    <section className="summary-panel"><div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-stone-500">预算进度</p><p className="mt-2 text-3xl font-bold">{formatMoney(spent,data.trip.currency)} <span className="text-base font-normal text-stone-400">/ {formatMoney(budget,data.trip.currency)}</span></p></div><p className={remaining<0?'font-semibold text-red-500':'font-semibold text-mint-600'}>{remaining<0?'超出预算':'剩余预算'} {formatMoney(Math.abs(remaining),data.trip.currency)}</p></div><div className="relative z-10 mt-5 h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-gradient-to-r from-mint-500 via-skysoft-500 to-coral-500" style={{width:`${percent}%`}}/></div><p className="relative z-10 mt-2 text-right text-xs text-stone-400">已使用 {percent.toFixed(1)}%</p></section>
    <div className="info-strip mt-5">所有预算统计统一使用人民币；外币消费会按消费日期取汇率，并在单笔记录中保留原币金额。</div>
    <div className="mt-5 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">{Object.entries(categoryTotals).map(([category,total])=><StatCard key={category} label={`${category} · ${data.trip.currency}`} value={formatMoney(total,data.trip.currency)} icon={category==='交通'?<WalletCards size={18}/>:<PieChart size={18}/>}/>)}</div>
    <div className="control-panel my-6 flex flex-wrap gap-2">{cats.map(category=><button key={category} onClick={()=>setFilter(category)} className={`rounded-full px-4 py-2 text-xs font-semibold ${filter===category?'bg-coral-500 text-white':'bg-white text-stone-500 shadow-sm'}`}>{category}</button>)}</div>
    <DocumentExportActions table={exportTable}/>
    {!items.length?<EmptyState title="还没有消费记录" message="第一杯咖啡、第一张车票，都可以成为旅行的一部分。" action="记一笔" onAction={()=>setEditing(null)}/>:<div className="space-y-6">{Object.entries(groups).map(([date,day])=><section key={date}><div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><h2 className="font-bold">{formatDate(date,{month:'long',day:'numeric',weekday:'long'})}</h2><span className="text-sm font-semibold text-stone-500">{formatMoney(day.reduce((sum,item)=>sum+Number(item.amount),0),'CNY')}</span></div><div className="card divide-y divide-stone-100 overflow-hidden">{day.map(item=><div key={item.id} className="flex min-w-0 flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-4 sm:p-5"><span className="shrink-0 rounded-xl bg-coral-50 p-3 text-coral-600"><WalletCards size={19}/></span><div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><p className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{item.title}</p><Badge tone="stone">{item.category}</Badge>{item.is_split&&<Badge tone="mint">AA</Badge>}</div><p className="mt-1 break-words text-xs text-stone-400 [overflow-wrap:anywhere]">{item.original_currency&&item.original_currency!=='CNY'&&item.original_amount?`${formatMoney(Number(item.original_amount),item.original_currency)} × ${item.exchange_rate} · `:''}{item.payment_method||'未填写支付方式'}</p></div><p className="shrink-0 font-bold">{formatMoney(Number(item.amount),'CNY')}</p><div className="ml-auto flex shrink-0"><IconButton aria-label="编辑" onClick={()=>setEditing(item)}><Edit3 size={17}/></IconButton><IconButton aria-label="删除" onClick={()=>void remove(item)}><Trash2 size={17}/></IconButton></div></div>)}</div></section>)}</div>}
    <Modal open={editing!==undefined} title={editing?'编辑消费':'记一笔'} onClose={()=>setEditing(undefined)}><ExpenseForm key={editing?.id||'new'} item={editing} tripId={tripId} onSave={save} onCancel={()=>setEditing(undefined)}/></Modal>
  </div>
}
