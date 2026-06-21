import { useEffect, useMemo, useState } from 'react'
import { Edit3, Heart, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { InspirationForm } from '../components/ResourceForms'
import { Badge, EmptyState, ErrorBanner, IconButton, ImageCover, LinkButton, Loading, Modal, PageHeader } from '../components/UI'
import { useLoad } from '../hooks/useLoad'
import type { Inspiration, NewItem } from '../types'

export default function Inspirations(){
  const {data,loading,error,reload}=useLoad(api.inspirations.list);const [tag,setTag]=useState('全部'),[editing,setEditing]=useState<Inspiration|null|undefined>(undefined),[params,setParams]=useSearchParams()
  useEffect(()=>{if(params.get('new')==='1'){setEditing(null);setParams({}, {replace:true})}},[params,setParams])
  const tags=useMemo(()=>['全部',...Array.from(new Set(data?.flatMap(x=>x.tags)||[]))],[data]),items=data?.filter(x=>tag==='全部'||x.tags.includes(tag))||[]
  const save=async(v:NewItem<Inspiration>)=>{editing?await api.inspirations.update(editing.id,v):await api.inspirations.create(v);setEditing(undefined);await reload()};const remove=async(x:Inspiration)=>{if(confirm(`确定删除“${x.title}”吗？`)){await api.inspirations.remove(x.id);await reload()}};const favorite=async(x:Inspiration)=>{const {id:_,...rest}=x;await api.inspirations.update(x.id,{...rest,favorite:!x.favorite});await reload()}
  if(loading)return <Loading/>
  return <div><PageHeader title="灵感收藏" description="先把心动收好，再慢慢拼成属于你的路线。" action="新增灵感" onAction={()=>setEditing(null)}/><ErrorBanner message={error}/><div className="mb-6 flex flex-wrap gap-2">{tags.map(x=><button key={x} onClick={()=>setTag(x)} className={`rounded-full px-4 py-2 text-xs font-semibold ${tag===x?'bg-coral-500 text-white':'bg-white text-stone-500 shadow-sm'}`}>{x}</button>)}</div>
    {!items.length?<EmptyState title="没有找到灵感" message="保存一篇攻略或换个标签看看。" action="新增灵感" onAction={()=>setEditing(null)}/>:<div className="columns-1 gap-5 sm:columns-2 xl:columns-3">{items.map(x=><article key={x.id} className="card mb-5 break-inside-avoid overflow-hidden"><ImageCover src={x.image_url} label={x.platform}/><div className="p-5"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold leading-7">{x.title}</h3><button aria-label="收藏" onClick={()=>void favorite(x)} className={x.favorite?'text-coral-500':'text-stone-300'}><Heart size={20} fill={x.favorite?'currentColor':'none'}/></button></div><div className="mt-3 flex flex-wrap gap-2">{x.tags.map(t=><Badge key={t} tone="mint">#{t}</Badge>)}</div>{x.related_place&&<p className="mt-3 text-xs text-stone-400">关联地点 · {x.related_place}</p>}{x.note&&<p className="mt-3 text-sm leading-6 text-stone-500">{x.note}</p>}<div className="mt-5 flex items-center justify-between"><LinkButton href={x.url}>{x.platform==='小红书'?'跳转小红书':'打开链接'}</LinkButton><div><IconButton aria-label="编辑" onClick={()=>setEditing(x)}><Edit3 size={17}/></IconButton><IconButton aria-label="删除" onClick={()=>void remove(x)}><Trash2 size={17}/></IconButton></div></div></div></article>)}</div>}
    <Modal open={editing!==undefined} title={editing?'编辑灵感':'新增灵感'} onClose={()=>setEditing(undefined)}><InspirationForm key={editing?.id||'new'} item={editing} onSave={save} onCancel={()=>setEditing(undefined)}/></Modal>
  </div>
}

