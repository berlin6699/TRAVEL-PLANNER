import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileViewer } from '@capacitor/file-viewer'
import { openDB } from 'idb'
import JSZip from 'jszip'
import type { ChecklistItem, City, Destination, Expense, ExportPayload, GeocodeResult, Inspiration, ItineraryItem, NewItem, Place, Reservation, ReservationAttachment, RouteLeg, Trip } from '../types'

type Entity = Trip | Destination | City | ItineraryItem | Reservation | Inspiration | Place | RouteLeg | Expense | ChecklistItem
type EntityStore = 'trips'|'destinations'|'cities'|'itinerary'|'reservations'|'inspirations'|'places'|'routeLegs'|'expenses'|'checklist'
type AttachmentRecord = ReservationAttachment & { data: ArrayBuffer }

const DATABASE_NAME='travel-planner-android'
const ENTITY_STORES:EntityStore[]=['trips','destinations','cities','itinerary','reservations','inspirations','places','routeLegs','expenses','checklist']
const ALL_STORES=[...ENTITY_STORES,'attachments'] as const
const attachmentUrls=new Map<number,string>()

const dbPromise=openDB(DATABASE_NAME,1,{upgrade(db){
  for(const name of ALL_STORES)if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id',autoIncrement:true})
}})

export class ApiError extends Error {
  constructor(message:string,public status=400){super(message)}
}

function today(){return new Date().toISOString().slice(0,10)}
function plusDays(days:number){const date=new Date();date.setDate(date.getDate()+days);return date.toISOString().slice(0,10)}

/** Keeps records created before multi-reservation support usable without a database reset. */
function normalizeItinerary(item:ItineraryItem):ItineraryItem{
  const ids=[...(Array.isArray(item.reservation_ids)?item.reservation_ids:[]),item.reservation_id]
    .filter((id):id is number=>typeof id==='number'&&Number.isInteger(id)&&id>0)
    .filter((id,index,all)=>all.indexOf(id)===index)
  return {...item,reservation_ids:ids,reservation_id:ids[0]??null}
}

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
  const db=await dbPromise;const id=Number(await db.add(store,value as any));return {...value,id} as T
}

async function updateEntity<T extends Entity>(store:EntityStore,id:number,data:NewItem<T>):Promise<T>{
  const value=store==='itinerary'?normalizeItinerary({...data,id} as unknown as ItineraryItem):{...data,id} as T
  const db=await dbPromise;await db.put(store,value);return value as T
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
  if(file.size>15*1024*1024)throw new ApiError('PDF 文件不能超过 15 MB',413)
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
}

function validatePayload(payload:ExportPayload){
  if(payload?.schema_version!==1||!Array.isArray(payload.trips)&&!payload.trip||!Array.isArray(payload.itinerary))throw new ApiError('备份数据格式无效')
}

async function importPayload(payload:ExportPayload){
  validatePayload(payload);await clearDatabase();const db=await dbPromise
  const collections:[EntityStore,any[]][]=[['trips',payload.trips?.length?payload.trips:[payload.trip]],['destinations',payload.destinations||[]],['cities',payload.cities||[]],['itinerary',payload.itinerary||[]],['reservations',payload.reservations||[]],['inspirations',payload.inspirations||[]],['places',payload.places||[]],['routeLegs',payload.route_legs||[]],['expenses',payload.expenses||[]],['checklist',payload.checklist||[]]]
  const tx=db.transaction(ENTITY_STORES,'readwrite');for(const [store,rows] of collections)for(const row of rows)await tx.objectStore(store).put(store==='itinerary'?normalizeItinerary(row as ItineraryItem):row);await tx.done;await ensureInitialized();return {message:'导入成功'}
}

async function importArchive(file:File){
  const zip=await JSZip.loadAsync(await file.arrayBuffer()),manifestFile=zip.file('travel-planner.json')
  if(!manifestFile)throw new ApiError('ZIP 中缺少 travel-planner.json')
  const manifest=JSON.parse(await manifestFile.async('text'));await importPayload(manifest as ExportPayload)
  const db=await dbPromise,attachments=Array.isArray(manifest.reservation_attachments)?manifest.reservation_attachments:[]
  for(const item of attachments){
    const archived=zip.file(String(item.archive_path));if(!archived)throw new ApiError(`ZIP 中缺少附件：${item.original_name}`)
    const data=await archived.async('arraybuffer'),signature=new TextDecoder().decode(data.slice(0,5));if(!signature.startsWith('%PDF-'))throw new ApiError(`附件不是有效 PDF：${item.original_name}`)
    await db.put('attachments',{id:Number(item.id),reservation_id:Number(item.reservation_id),original_name:String(item.original_name),mime_type:'application/pdf',size_bytes:data.byteLength,uploaded_at:String(item.uploaded_at||new Date().toISOString()),data})
  }
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
  geocode:{search:geocode},export:buildExport,exportArchive,import:importPayload,importArchive,reset,
}
