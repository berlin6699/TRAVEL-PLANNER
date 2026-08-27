import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileViewer } from '@capacitor/file-viewer'
import { openDB } from 'idb'
import { cancelAllItineraryReminders, cancelItineraryReminder, scheduleItineraryReminder, syncItineraryReminders } from '../services/localNotifications'
import type { ChecklistItem, City, Destination, Expense, ExportPayload, GeocodeResult, Inspiration, ItineraryItem, NewItem, Place, Reservation, ReservationAttachment, RouteLeg, Trip } from '../types'

type Entity = Trip | Destination | City | ItineraryItem | Reservation | Inspiration | Place | RouteLeg | Expense | ChecklistItem
type EntityStore = 'trips'|'destinations'|'cities'|'itinerary'|'reservations'|'inspirations'|'places'|'routeLegs'|'expenses'|'checklist'
type AttachmentRecord = ReservationAttachment & { data: ArrayBuffer }

const DATABASE_NAME='travel-planner-android'
const ENTITY_STORES:EntityStore[]=['trips','destinations','cities','itinerary','reservations','inspirations','places','routeLegs','expenses','checklist']
const ALL_STORES=[...ENTITY_STORES,'attachments'] as const
const attachmentUrls=new Map<number,string>()
const MAX_PDF_BYTES=15*1024*1024
const MAX_ARCHIVE_BYTES=250*1024*1024
const MAX_ARCHIVE_CONTENT_BYTES=300*1024*1024
const MAX_ARCHIVE_FILES=1000

const dbPromise=openDB(DATABASE_NAME,1,{upgrade(db){
  for(const name of ALL_STORES)if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id',autoIncrement:true})
}})

export class ApiError extends Error {
  constructor(message:string,public status=400){super(message)}
}

function today(){return new Date().toISOString().slice(0,10)}
function plusDays(days:number){const date=new Date();date.setDate(date.getDate()+days);return date.toISOString().slice(0,10)}
function normalizeReminderMinutes(value:unknown){return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=10080?value:null}

/** Keeps records created before multi-reservation support usable without a database reset. */
function normalizeItinerary(item:ItineraryItem):ItineraryItem{
  const ids=[...(Array.isArray(item.reservation_ids)?item.reservation_ids:[]),item.reservation_id]
    .filter((id):id is number=>typeof id==='number'&&Number.isInteger(id)&&id>0)
    .filter((id,index,all)=>all.indexOf(id)===index)
  return {...item,reservation_ids:ids,reservation_id:ids[0]??null,inspiration_id:item.inspiration_id??null,reminder_minutes:normalizeReminderMinutes(item.reminder_minutes)}
}

async function safelySyncReminder(item:ItineraryItem){try{await scheduleItineraryReminder(item)}catch(error){console.warn('无法同步行程提醒',error)}}
async function safelySyncAllReminders(items:ItineraryItem[]){try{await syncItineraryReminders(items.map(normalizeItinerary))}catch(error){console.warn('无法重建行程提醒',error)}}
async function safelyCancelReminder(id:number){try{await cancelItineraryReminder(id)}catch(error){console.warn('无法取消行程提醒',error)}}
async function safelyCancelAllReminders(){try{await cancelAllItineraryReminders()}catch(error){console.warn('无法取消全部行程提醒',error)}}

async function ensureInitialized(){
  const db=await dbPromise
  if(await db.count('trips'))return
  await db.add('trips',{name:'我的新旅程',start_date:today(),end_date:plusDays(7),total_budget:0,currency:'CNY'})
}

function compare(store:EntityStore,a:any,b:any){
  if(store==='itinerary')return `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`)
  if(store==='reservations')return `${a.date} ${a.time||''}`.localeCompare(`${b.date} ${b.time||''}`)
  if(store==='expenses')return `${b.date} ${b.id}`.localeCompare(`${a.date} ${a.id}`)
  if(['destinations','cities','routeLegs','checklist'].includes(store))return (a.order_index||0)-(b.order_index||0)||a.id-b.id
  return a.id-b.id
}

async function listEntities<T extends Entity>(store:EntityStore,params?:Record<string,string|number|boolean|null|undefined>):Promise<T[]>{
  await ensureInitialized();const db=await dbPromise
  const rows=await db.getAll(store) as T[]
  const matched=rows.filter(row=>Object.entries(params||{}).every(([key,value])=>value===null||value===undefined||value===''||(row as any)[key]===value))
  const normalized=store==='itinerary'?(matched as unknown as ItineraryItem[]).map(normalizeItinerary):matched
  return normalized.sort((a,b)=>compare(store,a,b)) as T[]
}

async function createEntity<T extends Entity>(store:EntityStore,data:NewItem<T>):Promise<T>{
  const value=store==='itinerary'?normalizeItinerary(data as unknown as ItineraryItem):data
  const db=await dbPromise;const id=Number(await db.add(store,value as any)),created={...value,id} as T
  if(store==='itinerary')await safelySyncReminder(created as unknown as ItineraryItem)
  return created
}

async function updateEntity<T extends Entity>(store:EntityStore,id:number,data:NewItem<T>):Promise<T>{
  const value=store==='itinerary'?normalizeItinerary({...data,id} as unknown as ItineraryItem):{...data,id} as T
  const db=await dbPromise;await db.put(store,value)
  if(store==='itinerary')await safelySyncReminder(value as unknown as ItineraryItem)
  return value as T
}

async function deleteTrip(id:number){
  const db=await dbPromise
  const reservations=(await db.getAll('reservations') as Reservation[]).filter(item=>item.trip_id===id)
  const reservationIds=new Set(reservations.map(item=>item.id))
  const tx=db.transaction(ALL_STORES as unknown as string[],'readwrite')
  for(const store of ENTITY_STORES){
    const rows=await tx.objectStore(store).getAll() as any[]
    for(const row of rows)if(store==='trips'?row.id===id:row.trip_id===id)await tx.objectStore(store).delete(row.id)
  }
  const files=await tx.objectStore('attachments').getAll() as AttachmentRecord[]
  for(const file of files)if(reservationIds.has(file.reservation_id))await tx.objectStore('attachments').delete(file.id)
  await tx.done
  await safelySyncAllReminders(await db.getAll('itinerary') as ItineraryItem[])
}

async function removeEntity(store:EntityStore,id:number){
  const db=await dbPromise
  if(store==='trips')return deleteTrip(id)
  if(store==='reservations'){
    const [files,itinerary]=await Promise.all([db.getAll('attachments') as Promise<AttachmentRecord[]>,db.getAll('itinerary') as Promise<ItineraryItem[]>])
    const tx=db.transaction(['reservations','attachments','itinerary'],'readwrite');await tx.objectStore('reservations').delete(id)
    for(const file of files)if(file.reservation_id===id)await tx.objectStore('attachments').delete(file.id)
    for(const item of itinerary){
      const reservation_ids=normalizeItinerary(item).reservation_ids?.filter(reservationId=>reservationId!==id)||[]
      if(reservation_ids.length!==(normalizeItinerary(item).reservation_ids?.length||0))await tx.objectStore('itinerary').put({...item,reservation_ids,reservation_id:reservation_ids[0]??null})
    }
    await tx.done;return
  }
  if(store==='inspirations'){
    const itinerary=await db.getAll('itinerary') as ItineraryItem[]
    const tx=db.transaction(['inspirations','itinerary'],'readwrite');await tx.objectStore('inspirations').delete(id)
    for(const item of itinerary)if(normalizeItinerary(item).inspiration_id===id)await tx.objectStore('itinerary').put({...item,inspiration_id:null})
    await tx.done;return
  }
  if(store==='itinerary')await safelyCancelReminder(id)
  await db.delete(store,id)
}

const resource=<T extends Entity>(store:EntityStore)=>({
  list:(params?:Record<string,string|number|boolean|null|undefined>)=>listEntities<T>(store,params),
  create:(data:NewItem<T>)=>createEntity<T>(store,data),
  update:(id:number,data:NewItem<T>)=>updateEntity<T>(store,id,data),
  remove:(id:number)=>removeEntity(store,id),
})

async function listAttachments(tripId:number):Promise<ReservationAttachment[]>{
  const db=await dbPromise
  const reservations=(await db.getAll('reservations') as Reservation[]).filter(item=>item.trip_id===tripId)
  const ids=new Set(reservations.map(item=>item.id)),files=(await db.getAll('attachments') as AttachmentRecord[]).filter(file=>ids.has(file.reservation_id))
  for(const file of files){
    if(!attachmentUrls.has(file.id))attachmentUrls.set(file.id,URL.createObjectURL(new Blob([file.data],{type:file.mime_type})))
  }
  return files.map(({data:_,...metadata})=>metadata)
}

async function uploadAttachment(reservationId:number,file:File):Promise<ReservationAttachment>{
  if(file.size>MAX_PDF_BYTES)throw new ApiError('PDF 文件不能超过 15 MB',413)
  const data=await file.arrayBuffer(),signature=new TextDecoder().decode(data.slice(0,5))
  if(!signature.startsWith('%PDF-'))throw new ApiError('文件不是有效的 PDF')
  const value={reservation_id:reservationId,original_name:file.name,mime_type:'application/pdf',size_bytes:file.size,uploaded_at:new Date().toISOString(),data}
  const db=await dbPromise,id=Number(await db.add('attachments',value));return {id,...value}
}

async function removeAttachment(id:number){
  const db=await dbPromise;await db.delete('attachments',id)
  const url=attachmentUrls.get(id);if(url)URL.revokeObjectURL(url);attachmentUrls.delete(id)
}

function arrayBufferToBase64(buffer:ArrayBuffer){
  const bytes=new Uint8Array(buffer);let binary='';const chunk=0x8000
  for(let index=0;index<bytes.length;index+=chunk)binary+=String.fromCharCode(...bytes.subarray(index,index+chunk))
  return btoa(binary)
}

async function openAttachment(id:number){
  const db=await dbPromise,file=await db.get('attachments',id) as AttachmentRecord|undefined
  if(!file)throw new ApiError('附件不存在',404)
  if(!Capacitor.isNativePlatform()){
    const url=attachmentUrls.get(id)||URL.createObjectURL(new Blob([file.data],{type:file.mime_type}));attachmentUrls.set(id,url);window.open(url,'_blank');return
  }
  const name=`attachment-${id}-${file.original_name.replace(/[^\w.\-\u4e00-\u9fff]/g,'_')}`
  const result=await Filesystem.writeFile({path:name,data:arrayBufferToBase64(file.data),directory:Directory.Cache})
  await FileViewer.openDocumentFromLocalPath({path:result.uri})
}

async function buildExport():Promise<ExportPayload>{
  await ensureInitialized();const db=await dbPromise
  const trips=await db.getAll('trips') as Trip[]
  return {
    schema_version:1,exported_at:new Date().toISOString(),trip:trips[0],trips,
    destinations:await db.getAll('destinations') as Destination[],cities:await db.getAll('cities') as City[],
    itinerary:await db.getAll('itinerary') as ItineraryItem[],reservations:await db.getAll('reservations') as Reservation[],
    inspirations:await db.getAll('inspirations') as Inspiration[],places:await db.getAll('places') as Place[],
    route_legs:await db.getAll('routeLegs') as RouteLeg[],expenses:await db.getAll('expenses') as Expense[],
    checklist:await db.getAll('checklist') as ChecklistItem[],
  }
}

async function exportArchive(){
  const {default:JSZip}=await import('jszip')
  const db=await dbPromise,payload=await buildExport(),files=await db.getAll('attachments') as AttachmentRecord[],zip=new JSZip(),manifest:any={...payload,reservation_attachments:[]}
  for(const file of files){
    const archivePath=`attachments/${file.id}-${file.original_name.replace(/[\\/]/g,'_')}`
    zip.file(archivePath,file.data);manifest.reservation_attachments.push({id:file.id,reservation_id:file.reservation_id,original_name:file.original_name,mime_type:file.mime_type,size_bytes:file.size_bytes,uploaded_at:file.uploaded_at,archive_path:archivePath})
  }
  zip.file('travel-planner.json',JSON.stringify(manifest,null,2));return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}})
}

async function clearDatabase(){
  const db=await dbPromise,tx=db.transaction(ALL_STORES as unknown as string[],'readwrite')
  for(const store of ALL_STORES)await tx.objectStore(store).clear()
  await tx.done
  for(const url of attachmentUrls.values())URL.revokeObjectURL(url);attachmentUrls.clear()
  await safelyCancelAllReminders()
}

function validatePayload(payload:ExportPayload){
  if(!payload||payload.schema_version!==1||(!Array.isArray(payload.trips)&&!payload.trip)||!Array.isArray(payload.itinerary))throw new ApiError('备份数据格式无效')
  const collections=[payload.trips?.length?payload.trips:[payload.trip],payload.destinations||[],payload.cities||[],payload.itinerary,payload.reservations||[],payload.inspirations||[],payload.places||[],payload.route_legs||[],payload.expenses||[],payload.checklist||[]]
  if(collections.some(rows=>!Array.isArray(rows)||rows.some(row=>!row||!Number.isInteger(Number(row.id))||Number(row.id)<=0)))throw new ApiError('备份数据包含无效记录')
  const trips=collections[0] as Trip[],tripIds=new Set(trips.map(item=>item.id)),reservations=payload.reservations||[],reservationIds=new Set(reservations.map(item=>item.id)),inspirations=payload.inspirations||[],inspirationIds=new Set(inspirations.map(item=>item.id))
  const reservationTrips=new Map(reservations.map(item=>[item.id,item.trip_id])),inspirationTrips=new Map(inspirations.map(item=>[item.id,item.trip_id]))
  const tripRecords=[...(payload.destinations||[]),...(payload.cities||[]),...payload.itinerary,...reservations,...(payload.inspirations||[]),...(payload.places||[]),...(payload.route_legs||[]),...(payload.expenses||[]),...(payload.checklist||[])] as Array<{trip_id:number}>
  if(tripRecords.some(item=>!tripIds.has(item.trip_id)))throw new ApiError('备份数据包含跨旅程或不存在的关联')
  for(const item of payload.itinerary){
    if(item.reminder_minutes!=null&&(!Number.isInteger(item.reminder_minutes)||item.reminder_minutes<0||item.reminder_minutes>10080))throw new ApiError(`日程“${item.title}”包含无效提醒时间`)
    const normalized=normalizeItinerary(item)
    if((normalized.reservation_ids||[]).some(id=>!reservationIds.has(id)||reservationTrips.get(id)!==item.trip_id)||(normalized.inspiration_id&&(!inspirationIds.has(normalized.inspiration_id)||inspirationTrips.get(normalized.inspiration_id)!==item.trip_id)))throw new ApiError(`日程“${item.title}”包含不存在或跨旅程的关联`)
  }
  const urls=[
    ...payload.itinerary.flatMap(item=>[item.map_url,item.image_url]),
    ...reservations.flatMap(item=>[item.booking_url,item.map_url,item.image_url]),
    ...(payload.inspirations||[]).flatMap(item=>[item.url,item.image_url]),
    ...(payload.places||[]).flatMap(item=>[item.map_url,item.image_url]),
  ].filter((value):value is string=>Boolean(value))
  if(urls.some(value=>{try{return !['http:','https:'].includes(new URL(value).protocol)}catch{return true}}))throw new ApiError('备份数据包含不安全的链接')
}

function payloadCollections(payload:ExportPayload):[EntityStore,any[]][] { return [['trips',payload.trips?.length?payload.trips:[payload.trip]],['destinations',payload.destinations||[]],['cities',payload.cities||[]],['itinerary',payload.itinerary||[]],['reservations',payload.reservations||[]],['inspirations',payload.inspirations||[]],['places',payload.places||[]],['routeLegs',payload.route_legs||[]],['expenses',payload.expenses||[]],['checklist',payload.checklist||[]]] }

async function replaceDatabase(payload:ExportPayload,attachments:AttachmentRecord[]=[]){
  validatePayload(payload)
  const db=await dbPromise,tx=db.transaction(ALL_STORES as unknown as string[],'readwrite')
  for(const store of ALL_STORES)await tx.objectStore(store).clear()
  for(const [store,rows] of payloadCollections(payload))for(const row of rows)await tx.objectStore(store).put(store==='itinerary'?normalizeItinerary(row as ItineraryItem):row)
  for(const attachment of attachments)await tx.objectStore('attachments').put(attachment)
  await tx.done
  for(const url of attachmentUrls.values())URL.revokeObjectURL(url);attachmentUrls.clear()
  await safelySyncAllReminders(payload.itinerary||[])
}

async function importPayload(payload:ExportPayload){await replaceDatabase(payload);return {message:'导入成功'}}

async function importArchive(file:File){
  const {default:JSZip}=await import('jszip')
  if(file.size>MAX_ARCHIVE_BYTES)throw new ApiError('完整备份 ZIP 不能超过 250 MB',413)
  const zip=await JSZip.loadAsync(await file.arrayBuffer()),entries=Object.values(zip.files)
  if(entries.length>MAX_ARCHIVE_FILES)throw new ApiError('ZIP 中的文件数量过多',413)
  const declaredBytes=entries.reduce((sum,entry)=>sum+((entry as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize||0),0)
  if(declaredBytes>MAX_ARCHIVE_CONTENT_BYTES)throw new ApiError('ZIP 解压后的内容过大',413)
  const manifestFile=zip.file('travel-planner.json');if(!manifestFile)throw new ApiError('ZIP 中缺少 travel-planner.json')
  const manifest=JSON.parse(await manifestFile.async('text')) as ExportPayload&{reservation_attachments?:Array<Record<string,unknown>>}
  validatePayload(manifest)
  const reservationIds=new Set((manifest.reservations||[]).map(item=>item.id)),metadata=Array.isArray(manifest.reservation_attachments)?manifest.reservation_attachments:[],seenPaths=new Set<string>(),attachments:AttachmentRecord[]=[]
  let totalBytes=0
  for(const item of metadata){
    const archivePath=String(item.archive_path||''),reservationId=Number(item.reservation_id),originalName=String(item.original_name||'ticket.pdf').replace(/[\\/]/g,'_')
    if(!archivePath||archivePath.startsWith('/')||archivePath.split(/[\\/]/).includes('..')||seenPaths.has(archivePath)||!reservationIds.has(reservationId))throw new ApiError('PDF 附件清单包含无效关联或路径')
    seenPaths.add(archivePath)
    const archived=zip.file(archivePath);if(!archived)throw new ApiError(`ZIP 中缺少附件：${originalName}`)
    const data=await archived.async('arraybuffer');totalBytes+=data.byteLength
    if(data.byteLength>MAX_PDF_BYTES)throw new ApiError(`PDF 文件不能超过 15 MB：${originalName}`,413)
    if(totalBytes>MAX_ARCHIVE_CONTENT_BYTES)throw new ApiError('ZIP 解压后的内容过大',413)
    const signature=new TextDecoder().decode(data.slice(0,5));if(!signature.startsWith('%PDF-'))throw new ApiError(`附件不是有效 PDF：${originalName}`)
    attachments.push({id:Number(item.id),reservation_id:reservationId,original_name:originalName,mime_type:'application/pdf',size_bytes:data.byteLength,uploaded_at:String(item.uploaded_at||new Date().toISOString()),data})
  }
  await replaceDatabase(manifest,attachments)
  return {message:'导入成功',counts:{trips:(manifest.trips||[]).length,attachments:attachments.length}}
}

async function reset(){await clearDatabase();await ensureInitialized()}

async function geocode(query:string):Promise<GeocodeResult[]>{
  const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=zh-CN&q=${encodeURIComponent(query)}`
  const response=await fetch(url,{headers:{Accept:'application/json'}});if(!response.ok)throw new ApiError('地点搜索暂时不可用',response.status)
  const rows=await response.json() as any[];return rows.map(row=>({name:String(row.name||row.display_name?.split(',')[0]||query),display_name:String(row.display_name),latitude:Number(row.lat),longitude:Number(row.lon),result_type:row.type?String(row.type):null}))
}

export const api={
  trip:{get:async()=>(await listEntities<Trip>('trips'))[0],update:async(data:Omit<Trip,'id'>)=>updateEntity<Trip>('trips',(await listEntities<Trip>('trips'))[0].id,data)},
  trips:resource<Trip>('trips'),destinations:resource<Destination>('destinations'),cities:resource<City>('cities'),itinerary:resource<ItineraryItem>('itinerary'),reservations:resource<Reservation>('reservations'),
  reservationAttachments:{list:listAttachments,upload:uploadAttachment,remove:removeAttachment,fileUrl:(id:number)=>attachmentUrls.get(id)||'#',open:openAttachment},
  inspirations:resource<Inspiration>('inspirations'),places:resource<Place>('places'),routeLegs:resource<RouteLeg>('routeLegs'),expenses:resource<Expense>('expenses'),checklist:resource<ChecklistItem>('checklist'),
  notifications:{sync:async()=>safelySyncAllReminders(await listEntities<ItineraryItem>('itinerary'))},
  geocode:{search:geocode},export:buildExport,exportArchive,import:importPayload,importArchive,reset,
}
