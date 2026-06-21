import { useState, type FormEvent } from 'react'
import type { City, Expense, Inspiration, ItineraryItem, NewItem, Place, Reservation, RouteLeg, TransportMode } from '../types'
import { ErrorBanner, FormActions, FormInput, FormSelect, FormTextarea } from './UI'

const today = () => new Date().toISOString().slice(0, 10)
const opts = (values: readonly string[]) => values.map(x => <option key={x}>{x}</option>)
type SaveProps<T extends { id: number }> = { item?: T | null; onSave: (data: NewItem<T>) => Promise<void>; onCancel: () => void }

function FormShell({ children, onSubmit, saving, error, onCancel }: { children: React.ReactNode; onSubmit: (e: FormEvent) => void; saving: boolean; error: string; onCancel: () => void }) {
  return <form onSubmit={onSubmit}><ErrorBanner message={error}/><div className="grid gap-4 sm:grid-cols-2">{children}</div><FormActions saving={saving} onCancel={onCancel}/></form>
}

function useSubmit<T>(action: (data: T) => Promise<void>) {
  const [saving,setSaving]=useState(false); const [error,setError]=useState('')
  const submit=async(data:T)=>{setSaving(true);setError('');try{await action(data)}catch(e){setError(e instanceof Error?e.message:'保存失败')}finally{setSaving(false)}}
  return {saving,error,submit}
}

export function ItineraryForm({ item, onSave, onCancel, reservations, places, cities }: SaveProps<ItineraryItem> & { reservations: Reservation[]; places: Place[]; cities: City[] }) {
  const [data,setData]=useState<NewItem<ItineraryItem>>(item ? { ...item } : { title:'',date:today(),start_time:'09:00',end_time:null,type:'景点',location:'',note:'',reservation_id:null,place_id:null,map_url:'',image_url:'',city_id:cities[0]?.id||null })
  const s=useSubmit(onSave); const change=(key:keyof typeof data,value:unknown)=>setData(v=>({...v,[key]:value}))
  return <FormShell onSubmit={e=>{e.preventDefault();void s.submit({...data,end_time:data.end_time||null,location:data.location||null,note:data.note||null,map_url:data.map_url||null,image_url:data.image_url||null})}} saving={s.saving} error={s.error} onCancel={onCancel}>
    <div className="sm:col-span-2"><FormInput required label="标题" placeholder="例如：清水寺晨间参观" value={data.title} onChange={e=>change('title',e.target.value)}/></div>
    <FormInput required type="date" label="日期" value={data.date} onChange={e=>change('date',e.target.value)}/><FormSelect label="城市" value={data.city_id??''} onChange={e=>change('city_id',e.target.value?Number(e.target.value):null)}><option value="">跨城市 / 未指定</option>{cities.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</FormSelect><FormSelect label="类型" value={data.type} onChange={e=>change('type',e.target.value)}>{opts(['交通','酒店','景点','餐饮','购物','其他'])}</FormSelect>
    <FormInput required type="time" label="开始时间" value={data.start_time.slice(0,5)} onChange={e=>change('start_time',e.target.value)}/><FormInput type="time" label="结束时间" value={data.end_time?.slice(0,5)||''} onChange={e=>change('end_time',e.target.value||null)}/>
    <div className="sm:col-span-2"><FormInput label="地点" placeholder="地点名称" value={data.location||''} onChange={e=>change('location',e.target.value)}/></div>
    <FormSelect label="关联预约" value={data.reservation_id??''} onChange={e=>change('reservation_id',e.target.value?Number(e.target.value):null)}><option value="">不关联</option>{reservations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</FormSelect>
    <FormSelect label="关联地点" value={data.place_id??''} onChange={e=>change('place_id',e.target.value?Number(e.target.value):null)}><option value="">不关联</option>{places.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</FormSelect>
    <FormInput type="url" label="地图链接" placeholder="https://…" value={data.map_url||''} onChange={e=>change('map_url',e.target.value)}/><FormInput type="url" label="图片链接" placeholder="https://…" value={data.image_url||''} onChange={e=>change('image_url',e.target.value)}/>
    <div className="sm:col-span-2"><FormTextarea label="备注" placeholder="交通、集合点或其他提醒" value={data.note||''} onChange={e=>change('note',e.target.value)}/></div>
  </FormShell>
}

export function ReservationForm({ item, onSave, onCancel, cities }: SaveProps<Reservation> & { cities: City[] }) {
  const [data,setData]=useState<NewItem<Reservation>>(item ? { ...item } : {name:'',type:'景点',date:today(),time:null,status:'待预约',order_number:'',location:'',note:'',booking_url:'',map_url:'',image_url:'',city_id:cities[0]?.id||null})
  const s=useSubmit(onSave); const change=(key:keyof typeof data,value:unknown)=>setData(v=>({...v,[key]:value}))
  return <FormShell onSubmit={e=>{e.preventDefault();void s.submit({...data,time:data.time||null,order_number:data.order_number||null,location:data.location||null,note:data.note||null,booking_url:data.booking_url||null,map_url:data.map_url||null,image_url:data.image_url||null})}} saving={s.saving} error={s.error} onCancel={onCancel}>
    <div className="sm:col-span-2"><FormInput required label="名称" placeholder="例如：岚山嵯峨野小火车" value={data.name} onChange={e=>change('name',e.target.value)}/></div>
    <FormSelect label="城市" value={data.city_id??''} onChange={e=>change('city_id',e.target.value?Number(e.target.value):null)}><option value="">跨城市 / 未指定</option>{cities.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</FormSelect><FormSelect label="类型" value={data.type} onChange={e=>change('type',e.target.value)}>{opts(['酒店','车票','机票','景点','餐厅','其他'])}</FormSelect><FormSelect label="状态" value={data.status} onChange={e=>change('status',e.target.value)}>{opts(['已预约','待预约','已完成','已取消'])}</FormSelect>
    <FormInput required type="date" label="日期" value={data.date} onChange={e=>change('date',e.target.value)}/><FormInput type="time" label="时间" value={data.time?.slice(0,5)||''} onChange={e=>change('time',e.target.value||null)}/>
    <FormInput label="预约号 / 订单号" placeholder="可选" value={data.order_number||''} onChange={e=>change('order_number',e.target.value)}/><FormInput label="地点" placeholder="集合地点" value={data.location||''} onChange={e=>change('location',e.target.value)}/>
    <FormInput type="url" label="预约链接" placeholder="https://…" value={data.booking_url||''} onChange={e=>change('booking_url',e.target.value)}/><FormInput type="url" label="地图链接" placeholder="https://…" value={data.map_url||''} onChange={e=>change('map_url',e.target.value)}/>
    <div className="sm:col-span-2"><FormInput type="url" label="图片链接" placeholder="https://…" value={data.image_url||''} onChange={e=>change('image_url',e.target.value)}/></div><div className="sm:col-span-2"><FormTextarea label="备注" value={data.note||''} onChange={e=>change('note',e.target.value)}/></div>
  </FormShell>
}

export function InspirationForm({ item, onSave, onCancel }: SaveProps<Inspiration>) {
  const [data,setData]=useState<NewItem<Inspiration>>(item ? { ...item } : {title:'',platform:'小红书',url:'',tags:[],related_place:'',note:'',image_url:'',favorite:true})
  const [tags,setTags]=useState(data.tags.join('，')); const s=useSubmit(onSave); const change=(key:keyof typeof data,value:unknown)=>setData(v=>({...v,[key]:value}))
  return <FormShell onSubmit={e=>{e.preventDefault();void s.submit({...data,tags:tags.split(/[,，]/).map(x=>x.trim()).filter(Boolean),related_place:data.related_place||null,note:data.note||null,image_url:data.image_url||null})}} saving={s.saving} error={s.error} onCancel={onCancel}>
    <div className="sm:col-span-2"><FormInput required label="标题" placeholder="这篇攻略讲了什么？" value={data.title} onChange={e=>change('title',e.target.value)}/></div>
    <FormSelect label="平台" value={data.platform} onChange={e=>change('platform',e.target.value)}>{opts(['小红书','公众号','网页','其他'])}</FormSelect><FormInput label="关联地点" placeholder="例如：祇园" value={data.related_place||''} onChange={e=>change('related_place',e.target.value)}/>
    <div className="sm:col-span-2"><FormInput required type="url" label="攻略链接" placeholder="https://…" value={data.url} onChange={e=>change('url',e.target.value)}/></div>
    <FormInput label="标签" placeholder="美食，拍照，小众" value={tags} onChange={e=>setTags(e.target.value)}/><FormInput type="url" label="封面图片链接" placeholder="https://…" value={data.image_url||''} onChange={e=>change('image_url',e.target.value)}/>
    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-coral-500" checked={data.favorite} onChange={e=>change('favorite',e.target.checked)}/>加入收藏</label><div/>
    <div className="sm:col-span-2"><FormTextarea label="备注" value={data.note||''} onChange={e=>change('note',e.target.value)}/></div>
  </FormShell>
}

export function PlaceForm({ item, onSave, onCancel, cities }: SaveProps<Place> & { cities: City[] }) {
  const initialCity=cities.find(x=>x.id===item?.city_id)||cities[0];
  const [data,setData]=useState<NewItem<Place>>(item ? { ...item } : {name:'',type:'景点',city:initialCity?.name||'',address:'',map_url:'',note:'',image_url:'',city_id:initialCity?.id||null,latitude:null,longitude:null}); const s=useSubmit(onSave); const change=(key:keyof typeof data,value:unknown)=>setData(v=>({...v,[key]:value}))
  return <FormShell onSubmit={e=>{e.preventDefault();void s.submit({...data,city:data.city||null,address:data.address||null,map_url:data.map_url||null,note:data.note||null,image_url:data.image_url||null})}} saving={s.saving} error={s.error} onCancel={onCancel}>
    <div className="sm:col-span-2"><FormInput required label="地点名称" placeholder="例如：浅草寺" value={data.name} onChange={e=>change('name',e.target.value)}/></div><FormSelect label="类型" value={data.type} onChange={e=>change('type',e.target.value)}>{opts(['酒店','车站','机场','景点','餐厅','商场','其他'])}</FormSelect><FormSelect label="所属城市" value={data.city_id??''} onChange={e=>{const id=e.target.value?Number(e.target.value):null;const city=cities.find(x=>x.id===id);setData(v=>({...v,city_id:id,city:city?.name||''}))}}><option value="">未指定</option>{cities.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</FormSelect>
    <div className="sm:col-span-2"><FormInput label="地址" placeholder="详细地址" value={data.address||''} onChange={e=>change('address',e.target.value)}/></div><FormInput type="number" step="0.000001" min="-90" max="90" label="纬度" placeholder="例如 35.714765" value={data.latitude??''} onChange={e=>change('latitude',e.target.value?Number(e.target.value):null)}/><FormInput type="number" step="0.000001" min="-180" max="180" label="经度" placeholder="例如 139.796655" value={data.longitude??''} onChange={e=>change('longitude',e.target.value?Number(e.target.value):null)}/><FormInput type="url" label="地图链接" placeholder="https://…" value={data.map_url||''} onChange={e=>change('map_url',e.target.value)}/><FormInput type="url" label="图片链接" placeholder="https://…" value={data.image_url||''} onChange={e=>change('image_url',e.target.value)}/><div className="sm:col-span-2"><FormTextarea label="备注" value={data.note||''} onChange={e=>change('note',e.target.value)}/></div>
  </FormShell>
}

export function CityForm({ item, onSave, onCancel }: SaveProps<City>) {
  const [data,setData]=useState<NewItem<City>>(item?{...item}:{trip_id:1,name:'',country:'',order_index:0,arrival_date:null,departure_date:null,latitude:null,longitude:null,note:''});const s=useSubmit(onSave);const change=(key:keyof typeof data,value:unknown)=>setData(v=>({...v,[key]:value}))
  return <FormShell onSubmit={e=>{e.preventDefault();void s.submit({...data,country:data.country||null,arrival_date:data.arrival_date||null,departure_date:data.departure_date||null,note:data.note||null})}} saving={s.saving} error={s.error} onCancel={onCancel}>
    <FormInput required label="城市名称" placeholder="例如：巴黎" value={data.name} onChange={e=>change('name',e.target.value)}/><FormInput label="国家 / 地区" placeholder="例如：法国" value={data.country||''} onChange={e=>change('country',e.target.value)}/><FormInput type="date" label="抵达日期" value={data.arrival_date||''} onChange={e=>change('arrival_date',e.target.value||null)}/><FormInput type="date" label="离开日期" value={data.departure_date||''} onChange={e=>change('departure_date',e.target.value||null)}/><FormInput required type="number" min="0" label="行程顺序" value={data.order_index} onChange={e=>change('order_index',Number(e.target.value))}/><div/><FormInput type="number" step="0.000001" min="-90" max="90" label="城市纬度" value={data.latitude??''} onChange={e=>change('latitude',e.target.value?Number(e.target.value):null)}/><FormInput type="number" step="0.000001" min="-180" max="180" label="城市经度" value={data.longitude??''} onChange={e=>change('longitude',e.target.value?Number(e.target.value):null)}/><div className="sm:col-span-2"><FormTextarea label="城市备注" placeholder="本城的旅行重点" value={data.note||''} onChange={e=>change('note',e.target.value)}/></div>
  </FormShell>
}

const TRANSPORT_MODES:TransportMode[]=['步行','公共交通','出租车','自驾','骑行','火车','大巴','飞机','轮渡','其他']
export function RouteLegForm({ item, onSave, onCancel, places, reservations }: SaveProps<RouteLeg> & { places: Place[]; reservations: Reservation[] }) {
  const [data,setData]=useState<NewItem<RouteLeg>>(item?{...item}:{title:'',from_place_id:places[0]?.id||0,to_place_id:places[1]?.id||0,transport_modes:['步行','公共交通'],selected_mode:'公共交通',duration_minutes:null,reservation_id:null,order_index:0,note:''});const s=useSubmit(onSave);const change=(key:keyof typeof data,value:unknown)=>setData(v=>({...v,[key]:value}));const toggle=(mode:TransportMode)=>setData(v=>{const modes=v.transport_modes.includes(mode)?v.transport_modes.filter(x=>x!==mode):[...v.transport_modes,mode];return {...v,transport_modes:modes,selected_mode:v.selected_mode&&modes.includes(v.selected_mode)?v.selected_mode:(modes[0]||null)}})
  return <FormShell onSubmit={e=>{e.preventDefault();void s.submit({...data,duration_minutes:data.duration_minutes||null,reservation_id:data.reservation_id||null,note:data.note||null})}} saving={s.saving} error={s.error} onCancel={onCancel}>
    <div className="sm:col-span-2"><FormInput required label="路线名称" placeholder="例如：京都 → 东京" value={data.title} onChange={e=>change('title',e.target.value)}/></div><FormSelect required label="起点" value={data.from_place_id} onChange={e=>change('from_place_id',Number(e.target.value))}>{places.map(x=><option key={x.id} value={x.id}>{x.city} · {x.name}</option>)}</FormSelect><FormSelect required label="终点" value={data.to_place_id} onChange={e=>change('to_place_id',Number(e.target.value))}>{places.map(x=><option key={x.id} value={x.id}>{x.city} · {x.name}</option>)}</FormSelect><div className="sm:col-span-2"><p className="text-sm font-medium text-stone-700">可选交通方式</p><div className="mt-2 flex flex-wrap gap-2">{TRANSPORT_MODES.map(mode=><label key={mode} className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-semibold ${data.transport_modes.includes(mode)?'border-coral-500 bg-coral-50 text-coral-700':'border-stone-200 text-stone-500'}`}><input type="checkbox" className="sr-only" checked={data.transport_modes.includes(mode)} onChange={()=>toggle(mode)}/>{mode}</label>)}</div></div><FormSelect label="当前选择" value={data.selected_mode||''} onChange={e=>change('selected_mode',e.target.value||null)}><option value="">暂未决定</option>{data.transport_modes.map(x=><option key={x}>{x}</option>)}</FormSelect><FormInput type="number" min="1" label="预计分钟" value={data.duration_minutes??''} onChange={e=>change('duration_minutes',e.target.value?Number(e.target.value):null)}/><FormSelect label="关联交通预约" value={data.reservation_id??''} onChange={e=>change('reservation_id',e.target.value?Number(e.target.value):null)}><option value="">不关联</option>{reservations.filter(x=>['车票','机票','其他'].includes(x.type)).map(x=><option key={x.id} value={x.id}>{x.type} · {x.name}</option>)}</FormSelect><FormInput type="number" min="0" label="路线顺序" value={data.order_index} onChange={e=>change('order_index',Number(e.target.value))}/><div className="sm:col-span-2"><FormTextarea label="路线备注" value={data.note||''} onChange={e=>change('note',e.target.value)}/></div>
  </FormShell>
}

export function ExpenseForm({ item, onSave, onCancel, itinerary, reservations, tripCurrency }: SaveProps<Expense> & { itinerary: ItineraryItem[]; reservations: Reservation[]; tripCurrency: string }) {
  const [data,setData]=useState<NewItem<Expense>>(item ? { ...item } : {title:'',amount:0,currency:tripCurrency,date:today(),category:'餐饮',payment_method:'',note:'',is_split:false,itinerary_id:null,reservation_id:null}); const s=useSubmit(onSave); const change=(key:keyof typeof data,value:unknown)=>setData(v=>({...v,[key]:value}))
  return <FormShell onSubmit={e=>{e.preventDefault();void s.submit({...data,payment_method:data.payment_method||null,note:data.note||null})}} saving={s.saving} error={s.error} onCancel={onCancel}>
    <div className="sm:col-span-2"><FormInput required label="消费项目" placeholder="例如：拉面午餐" value={data.title} onChange={e=>change('title',e.target.value)}/></div><FormInput required min="0.01" step="0.01" type="number" label="金额" value={data.amount||''} onChange={e=>change('amount',Number(e.target.value))}/><FormSelect label="币种" value={data.currency} onChange={e=>change('currency',e.target.value)}>{currencyOptions}</FormSelect>
    <FormInput required type="date" label="日期" value={data.date} onChange={e=>change('date',e.target.value)}/>
    <FormSelect label="分类" value={data.category} onChange={e=>change('category',e.target.value)}>{opts(['交通','住宿','餐饮','门票','购物','其他'])}</FormSelect><FormInput label="支付方式" placeholder="微信 / 信用卡 / 现金" value={data.payment_method||''} onChange={e=>change('payment_method',e.target.value)}/>
    <FormSelect label="关联日程" value={data.itinerary_id??''} onChange={e=>change('itinerary_id',e.target.value?Number(e.target.value):null)}><option value="">不关联</option>{itinerary.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</FormSelect><FormSelect label="关联预约" value={data.reservation_id??''} onChange={e=>change('reservation_id',e.target.value?Number(e.target.value):null)}><option value="">不关联</option>{reservations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</FormSelect>
    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-coral-500" checked={data.is_split} onChange={e=>change('is_split',e.target.checked)}/>这笔消费需要 AA</label><div/><div className="sm:col-span-2"><FormTextarea label="备注" value={data.note||''} onChange={e=>change('note',e.target.value)}/></div>
  </FormShell>
}

export const currencyOptions = <>{[
  ['CNY','人民币 CNY'],['USD','美元 USD'],['EUR','欧元 EUR'],['GBP','英镑 GBP'],['JPY','日元 JPY'],
  ['HKD','港币 HKD'],['KRW','韩元 KRW'],['THB','泰铢 THB'],['SGD','新加坡元 SGD'],['AUD','澳元 AUD'],
  ['CAD','加元 CAD'],['CHF','瑞士法郎 CHF'],
].map(([value,label])=><option key={value} value={value}>{label}</option>)}</>
