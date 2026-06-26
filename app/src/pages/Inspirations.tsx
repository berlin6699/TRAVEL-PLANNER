import { useEffect, useMemo, useState } from 'react'
import { Edit3, Heart, Search, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { DocumentExportActions } from '../components/DocumentExportActions'
import { InspirationForm } from '../components/ResourceForms'
import { Badge, EmptyState, ErrorBanner, IconButton, ImageCover, LinkButton, Loading, Modal, PageHeader } from '../components/UI'
import { useLoad } from '../hooks/useLoad'
import { useTrip } from '../contexts/TripContext'
import type { Inspiration, NewItem } from '../types'

export default function Inspirations(){
  const {selectedTrip}=useTrip();const tripId=selectedTrip!.id
  const {data,loading,error,reload}=useLoad(()=>api.inspirations.list({trip_id:tripId}));const [tag,setTag]=useState('全部'),[query,setQuery]=useState(''),[editing,setEditing]=useState<Inspiration|null|undefined>(undefined),[params,setParams]=useSearchParams()
  useEffect(()=>{if(params.get('new')==='1'){setEditing(null);setParams({}, {replace:true})}},[params,setParams])
  const requestedId=Number(params.get('id'))||null
  useEffect(()=>{if(!requestedId||!data?.some(item=>item.id===requestedId))return;setTag('全部');setQuery('');window.setTimeout(()=>document.getElementById(`inspiration-${requestedId}`)?.scrollIntoView({behavior:'smooth',block:'center'}),50)},[requestedId,data])
  const tags=useMemo(()=>['全部',...Array.from(new Set(data?.flatMap(item=>item.tags)||[]))],[data])
  const normalizedQuery=query.trim().toLocaleLowerCase('zh-CN')
  const items=data?.filter(item=>{const haystack=[item.title,item.platform,item.related_place,item.note,item.url,...item.tags].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN');return (tag==='全部'||item.tags.includes(tag))&&(!normalizedQuery||haystack.includes(normalizedQuery))})||[]
  const save=async(value:NewItem<Inspiration>)=>{editing?await api.inspirations.update(editing.id,value):await api.inspirations.create(value);setEditing(undefined);await reload()};const remove=async(item:Inspiration)=>{if(confirm(`确定删除“${item.title}”吗？`)){await api.inspirations.remove(item.id);await reload()}};const favorite=async(item:Inspiration)=>{const {id:_,...rest}=item;await api.inspirations.update(item.id,{...rest,favorite:!item.favorite});await reload()}
  if(loading)return <Loading/>;if(!data)return <ErrorBanner message={error}/>
  const exportTable={title:`${selectedTrip!.name} · 灵感收藏`,description:`${tag==='全部'?'全部标签':`标签：${tag}`} · 当前筛选结果`,columns:[{label:'标题'},{label:'平台'},{label:'关联地点'},{label:'标签'},{label:'链接'},{label:'备注'},{label:'收藏'}],rows:items.map(item=>[item.title,item.platform,item.related_place||'—',item.tags.map(value=>`#${value}`).join(' ')||'—',item.url,item.note||'—',item.favorite?'是':'否'])}
  return <div><PageHeader title="灵感收藏" description="先把心动收好，再慢慢拼成属于你的路线。" action="新增灵感" onAction={()=>setEditing(null)}/><ErrorBanner message={error}/><div className="control-panel mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{tags.map(value=><button key={value} onClick={()=>setTag(value)} className={`rounded-full px-4 py-2 text-xs font-semibold ${tag===value?'bg-coral-500 text-white':'bg-white text-stone-500 shadow-sm'}`}>{value}</button>)}</div><label className="relative block lg:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16}/><input aria-label="搜索灵感" className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-coral-400" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索标题、标签、地点或备注"/></label></div>
    <DocumentExportActions table={exportTable}/>
    {!items.length?<EmptyState title={query?'没有找到匹配灵感':'没有找到灵感'} message={query?'换个关键词，或清空搜索后再试试。':'保存一篇攻略或换个标签看看。'} action="新增灵感" onAction={()=>setEditing(null)}/>:<div className="columns-1 gap-5 sm:columns-2 xl:columns-3">{items.map(item=><article id={`inspiration-${item.id}`} key={item.id} className={`card mb-5 break-inside-avoid overflow-hidden transition ${requestedId===item.id?'ring-2 ring-mint-500 ring-offset-2 ring-offset-cream':''}`}><ImageCover src={item.image_url} label={item.platform}/><div className="p-5"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold leading-7">{item.title}</h3><button aria-label="收藏" onClick={()=>void favorite(item)} className={item.favorite?'text-coral-500':'text-stone-300'}><Heart size={20} fill={item.favorite?'currentColor':'none'}/></button></div><div className="mt-3 flex flex-wrap gap-2">{item.tags.map(value=><Badge key={value} tone="mint">#{value}</Badge>)}</div>{item.related_place&&<p className="mt-3 text-xs text-stone-400">关联地点 · {item.related_place}</p>}{item.note&&<p className="mt-3 text-sm leading-6 text-stone-500">{item.note}</p>}<div className="mt-5 flex items-center justify-between"><LinkButton href={item.url}>{item.platform==='小红书'?'跳转小红书':'打开链接'}</LinkButton><div><IconButton aria-label="编辑" onClick={()=>setEditing(item)}><Edit3 size={17}/></IconButton><IconButton aria-label="删除" onClick={()=>void remove(item)}><Trash2 size={17}/></IconButton></div></div></div></article>)}</div>}
    <Modal open={editing!==undefined} title={editing?'编辑灵感':'新增灵感'} onClose={()=>setEditing(undefined)}><InspirationForm key={editing?.id||'new'} item={editing} tripId={tripId} onSave={save} onCancel={()=>setEditing(undefined)}/></Modal>
  </div>
}
