import { useEffect, useState } from 'react'
import { Clock, Edit3, MapPin, NotebookTabs, Trash2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import MapPreview, { MapButton, type MapTarget } from '../components/MapPreview'
import { ItineraryForm } from '../components/ResourceForms'
import { Badge, EmptyState, ErrorBanner, IconButton, Loading, Modal, PageHeader } from '../components/UI'
import { useLoad } from '../hooks/useLoad'
import { useTrip } from '../contexts/TripContext'
import type { City, ItineraryItem, NewItem } from '../types'
import { formatDate } from '../utils'

export default function Itinerary(){
  const {selectedTrip}=useTrip();const tripId=selectedTrip!.id
  const {data,loading,error,reload}=useLoad(async()=>{const [items,reservations,places,cities]=await Promise.all([api.itinerary.list({trip_id:tripId}),api.reservations.list({trip_id:tripId}),api.places.list({trip_id:tripId}),api.cities.list({trip_id:tripId})]);return {items,reservations,places,cities}})
  const [editing,setEditing]=useState<ItineraryItem|null|undefined>(undefined),[mapTarget,setMapTarget]=useState<MapTarget|null>(null),[params,setParams]=useSearchParams(),navigate=useNavigate()
  useEffect(()=>{if(params.get('new')==='1'){setEditing(null);setParams({}, {replace:true})}},[params,setParams])
  const save=async(value:NewItem<ItineraryItem>)=>{editing?await api.itinerary.update(editing.id,value):await api.itinerary.create(value);setEditing(undefined);await reload()}
  const remove=async(item:ItineraryItem)=>{if(confirm(`确定删除“${item.title}”吗？`)){await api.itinerary.remove(item.id);await reload()}}
  if(loading)return <Loading/>;if(!data)return <ErrorBanner message={error}/>
  const sections:[City|null,ItineraryItem[]][]=[...data.cities.map(city=>[city,data.items.filter(x=>x.city_id===city.id)] as [City,ItineraryItem[]])]
  const unassigned=data.items.filter(x=>!x.city_id);if(unassigned.length)sections.push([null,unassigned])
  return <div><PageHeader title="旅行日程" description="按城市展开旅程，再把每一天安排得松弛有序。" action="新增日程" onAction={()=>setEditing(null)}/><ErrorBanner message={error}/>
    {!data.items.length?<EmptyState title="还没有日程" message="从第一座城市的抵达、入住或第一顿饭开始吧。" action="新增日程" onAction={()=>setEditing(null)}/>:<div className="space-y-10">{sections.map(([city,items],sectionIndex)=>items.length?<section key={city?.id||'unassigned'}><div className="card mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-coral-500 font-bold text-white">{city?sectionIndex+1:'?'}</span><div><p className="text-xs font-semibold uppercase tracking-widest text-coral-600">{city?'CITY STOP':'CROSS CITY'}</p><h2 className="text-2xl font-bold">{city?.name||'跨城市 / 未分组'}</h2></div></div>{city&&<div className="text-sm text-stone-500">{city.arrival_date&&formatDate(city.arrival_date)}{city.departure_date&&` — ${formatDate(city.departure_date)}`}</div>}</div><CityDays items={items} onEdit={setEditing} onDelete={remove} onMap={setMapTarget} onReservation={id=>navigate(`/reservations?id=${id}`)}/></section>:null)}</div>}
    <Modal open={editing!==undefined} title={editing?'编辑日程':'新增日程'} onClose={()=>setEditing(undefined)}><ItineraryForm key={editing?.id||'new'} item={editing} reservations={data.reservations} places={data.places} cities={data.cities} tripId={tripId} onSave={save} onCancel={()=>setEditing(undefined)}/></Modal><MapPreview target={mapTarget} onClose={()=>setMapTarget(null)}/>
  </div>
}

function CityDays({items,onEdit,onDelete,onMap,onReservation}:{items:ItineraryItem[];onEdit:(x:ItineraryItem)=>void;onDelete:(x:ItineraryItem)=>Promise<void>;onMap:(x:MapTarget)=>void;onReservation:(id:number)=>void}){
  const groups=items.reduce<Record<string,ItineraryItem[]>>((result,item)=>{(result[item.date]??=[]).push(item);return result},{})
  return <div className="space-y-7">{Object.entries(groups).map(([date,dayItems])=><div key={date}><div className="mb-3"><h3 className="font-bold">{formatDate(date,{month:'long',day:'numeric',weekday:'long'})}</h3><p className="text-xs text-stone-400">{dayItems.length} 项安排</p></div><div className="space-y-3 border-l-2 border-coral-100 pl-5 sm:pl-8">{dayItems.map(item=><article key={item.id} className="card relative p-5"><span className="absolute -left-[27px] top-7 h-3 w-3 rounded-full bg-coral-500 ring-4 ring-cream sm:-left-[39px]"/><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="flex min-w-24 items-center gap-2 font-bold text-coral-600"><Clock size={16}/>{item.start_time.slice(0,5)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="text-lg font-bold">{item.title}</h4><Badge tone={item.type==='景点'?'mint':'sky'}>{item.type}</Badge></div>{item.location&&<p className="mt-2 flex items-center gap-1.5 text-sm text-stone-500"><MapPin size={15}/>{item.location}</p>}{item.note&&<p className="mt-3 text-sm leading-6 text-stone-500">{item.note}</p>}<div className="mt-4 flex flex-wrap gap-4">{item.map_url&&<MapButton target={{title:item.title,url:item.map_url,query:item.location}} onOpen={onMap}/>} {item.reservation_id&&<button className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral-600" onClick={()=>onReservation(item.reservation_id!)}><NotebookTabs size={15}/>查看预约</button>}</div></div><div className="flex"><IconButton aria-label="编辑" onClick={()=>onEdit(item)}><Edit3 size={17}/></IconButton><IconButton aria-label="删除" onClick={()=>void onDelete(item)}><Trash2 size={17}/></IconButton></div></div></article>)}</div></div>)}</div>
}
