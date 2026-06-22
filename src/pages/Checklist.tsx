import { useState, type FormEvent } from 'react'
import { Backpack, Check, Circle, CopyPlus, Edit3, ListTodo, Sparkles, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { Badge, EmptyState, ErrorBanner, FormActions, FormInput, FormSelect, FormTextarea, IconButton, Loading, Modal, PageHeader, StatCard } from '../components/UI'
import { useLoad } from '../hooks/useLoad'
import { useTrip } from '../contexts/TripContext'
import type { ChecklistItem, ChecklistKind, NewItem } from '../types'
import { formatDate } from '../utils'
import { checklistTemplates, type ChecklistTemplate } from '../data/checklistTemplates'

export default function Checklist(){
  const {selectedTrip}=useTrip();const tripId=selectedTrip!.id
  const {data,loading,error,reload}=useLoad(()=>api.checklist.list({trip_id:tripId}))
  const [tab,setTab]=useState<ChecklistKind>('行李'),[editing,setEditing]=useState<ChecklistItem|null|undefined>(undefined)
  const [applying,setApplying]=useState(''),[templateMessage,setTemplateMessage]=useState('')
  if(loading)return <Loading/>;if(!data)return <ErrorBanner message={error}/>
  const items=data.filter(x=>x.kind===tab),done=items.filter(x=>x.completed).length,percent=items.length?done/items.length*100:0
  const save=async(value:NewItem<ChecklistItem>)=>{editing?await api.checklist.update(editing.id,value):await api.checklist.create(value);setEditing(undefined);await reload()}
  const toggle=async(item:ChecklistItem)=>{const {id:_,...payload}=item;await api.checklist.update(item.id,{...payload,completed:!item.completed});await reload()}
  const remove=async(item:ChecklistItem)=>{if(confirm(`确定删除“${item.title}”吗？`)){await api.checklist.remove(item.id);await reload()}}
  const applyTemplate=async(template:ChecklistTemplate)=>{
    setApplying(template.id);setTemplateMessage('')
    try{
      const normalize=(value:string)=>value.trim().toLocaleLowerCase('zh-CN')
      const existing=new Set(data.filter(x=>x.kind===template.kind).map(x=>`${normalize(x.category||'')}|${normalize(x.title)}`))
      const missing=template.items.filter(x=>!existing.has(`${normalize(x.category)}|${normalize(x.title)}`))
      for(const [index,item] of missing.entries())await api.checklist.create({trip_id:tripId,kind:template.kind,title:item.title,category:item.category,quantity:item.quantity||1,completed:false,due_date:null,note:null,order_index:data.length+index})
      setTab(template.kind);setTemplateMessage(missing.length?`已从“${template.name}”补充 ${missing.length} 项`:`“${template.name}”中的项目已经齐全`);await reload()
    }catch(err){setTemplateMessage(err instanceof Error?err.message:'模板应用失败')}finally{setApplying('')}
  }
  return <div><PageHeader title="行前清单" description="要带的东西和出发前要办的事，各自归位，完成一项就勾掉一项。" action={tab==='行李'?'添加物品':'添加待办'} onAction={()=>setEditing(null)}/><ErrorBanner message={error}/>
    <div className="mb-5 inline-flex rounded-2xl bg-white p-1 shadow-sm"><button onClick={()=>setTab('行李')} className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold ${tab==='行李'?'bg-coral-500 text-white':'text-stone-500'}`}><Backpack size={17}/>行李清单</button><button onClick={()=>setTab('待办')} className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold ${tab==='待办'?'bg-coral-500 text-white':'text-stone-500'}`}><ListTodo size={17}/>待办事项</button></div>
    <section className="card mb-6 min-w-0 max-w-full overflow-hidden p-5 sm:p-6"><div className="flex items-start gap-3"><span className="rounded-xl bg-mint-50 p-2.5 text-mint-600"><Sparkles size={19}/></span><div className="min-w-0"><h2 className="font-bold">可复用模板</h2><p className="mt-1 text-xs leading-5 text-stone-400">模板适用于所有旅程；只补充缺少的项目，不会重复添加。</p></div></div><div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">{checklistTemplates.filter(x=>x.kind===tab).map(template=><button key={template.id} disabled={Boolean(applying)} onClick={()=>void applyTemplate(template)} className="pressable-card group flex min-w-0 max-w-full items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50/70 p-4 text-left transition hover:border-coral-100 hover:bg-coral-50"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-coral-500 shadow-sm"><CopyPlus size={18}/></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{template.name}</b><small className="template-description mt-1 block text-xs leading-5 text-stone-400">{template.description}</small></span><span className="shrink-0 text-xs font-bold text-coral-500">{applying===template.id?'添加中':`+${template.items.length}`}</span></button>)}</div>{templateMessage&&<p className="mt-4 rounded-xl bg-mint-50 px-3 py-2 text-xs font-semibold text-mint-700">{templateMessage}</p>}</section>
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label={tab==='行李'?'已装入行李':'已完成'} value={`${done} / ${items.length}`} icon={<Check/>}/><div className="card p-5 sm:col-span-2"><div className="flex justify-between text-sm font-medium text-stone-500"><span>完成进度</span><span>{percent.toFixed(0)}%</span></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-gradient-to-r from-mint-500 to-coral-500" style={{width:`${percent}%`}}/></div></div></div>
    {!items.length?<EmptyState title={tab==='行李'?'还没有行李物品':'还没有待办事项'} message={tab==='行李'?'从证件、衣物、电子设备开始列吧。':'把订票、签证、换汇和临出发提醒记在这里。'} action={tab==='行李'?'添加物品':'添加待办'} onAction={()=>setEditing(null)}/>:<div className="card divide-y divide-stone-100 overflow-hidden">{items.map(item=><div key={item.id} className={`flex items-start gap-3 p-4 sm:p-5 ${item.completed?'bg-stone-50/70':''}`}><button aria-label={item.completed?'标为未完成':'标为完成'} onClick={()=>void toggle(item)} className={`mt-0.5 shrink-0 rounded-full ${item.completed?'bg-mint-500 p-1 text-white':'text-stone-300'}`}>{item.completed?<Check size={16}/>:<Circle size={24}/>}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className={`font-semibold ${item.completed?'text-stone-400 line-through':''}`}>{item.title}</p>{item.category&&<Badge tone="stone">{item.category}</Badge>}{tab==='行李'&&item.quantity>1&&<Badge tone="sky">× {item.quantity}</Badge>}</div>{item.due_date&&<p className="mt-1 text-xs text-coral-600">计划完成：{formatDate(item.due_date)}</p>}{item.note&&<p className="mt-1 text-sm text-stone-400">{item.note}</p>}</div><div className="flex shrink-0"><IconButton aria-label="编辑" onClick={()=>setEditing(item)}><Edit3 size={17}/></IconButton><IconButton aria-label="删除" onClick={()=>void remove(item)}><Trash2 size={17}/></IconButton></div></div>)}</div>}
    <Modal open={editing!==undefined} title={editing?'编辑清单项':tab==='行李'?'添加物品':'添加待办'} onClose={()=>setEditing(undefined)}><ChecklistForm key={editing?.id||`new-${tab}`} item={editing} kind={tab} tripId={tripId} onSave={save} onCancel={()=>setEditing(undefined)}/></Modal>
  </div>
}

function ChecklistForm({item,kind,tripId,onSave,onCancel}:{item?:ChecklistItem|null;kind:ChecklistKind;tripId:number;onSave:(value:NewItem<ChecklistItem>)=>Promise<void>;onCancel:()=>void}){
  const [data,setData]=useState<NewItem<ChecklistItem>>(item?{...item}:{trip_id:tripId,kind,title:'',category:kind==='行李'?'证件': '预订',quantity:1,completed:false,due_date:null,note:'',order_index:0})
  const [saving,setSaving]=useState(false),[error,setError]=useState('')
  const submit=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError('');try{await onSave({...data,category:data.category||null,due_date:data.due_date||null,note:data.note||null})}catch(err){setError(err instanceof Error?err.message:'保存失败')}finally{setSaving(false)}}
  const categories=data.kind==='行李'?['证件','衣物','洗护','药品','电子设备','摄影','其他']:['预订','证件','交通','行程确认','购物','其他']
  return <form onSubmit={submit}><ErrorBanner message={error}/><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><FormInput required label={data.kind==='行李'?'物品名称':'待办事项'} value={data.title} onChange={e=>setData(v=>({...v,title:e.target.value}))}/></div><FormSelect label="分类" value={data.category||''} onChange={e=>setData(v=>({...v,category:e.target.value}))}>{categories.map(x=><option key={x}>{x}</option>)}</FormSelect>{data.kind==='行李'?<FormInput required type="number" min="1" max="999" label="数量" value={data.quantity} onChange={e=>setData(v=>({...v,quantity:Number(e.target.value)}))}/>:<FormInput type="date" label="计划完成日期" value={data.due_date||''} onChange={e=>setData(v=>({...v,due_date:e.target.value||null}))}/>}<div className="sm:col-span-2"><FormTextarea label="备注" value={data.note||''} onChange={e=>setData(v=>({...v,note:e.target.value}))}/></div><label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-coral-500" checked={data.completed} onChange={e=>setData(v=>({...v,completed:e.target.checked}))}/>{data.kind==='行李'?'已经装好':'已经完成'}</label></div><FormActions saving={saving} onCancel={onCancel}/></form>
}
