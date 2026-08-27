import { beforeAll, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { api } from '../api/client'

describe('手机本地数据层',()=>{
  beforeAll(async()=>{await api.reset()})

  it('离线创建旅程数据并按旅程筛选',async()=>{
    const [trip]=await api.trips.list()
    const destination=await api.destinations.create({trip_id:trip.id,name:'日本',type:'国家',code:'JP',order_index:0,parent_id:null,note:null})
    const city=await api.cities.create({trip_id:trip.id,destination_id:destination.id,name:'东京',country:'日本',order_index:0,arrival_date:trip.start_date,departure_date:trip.end_date,latitude:35.6762,longitude:139.6503,note:null})
    await api.itinerary.create({trip_id:trip.id,title:'抵达东京',date:trip.start_date,start_time:'10:00',end_time:null,type:'交通',location:'东京站',note:null,reservation_id:null,place_id:null,map_url:null,image_url:null,city_id:city.id})

    expect(await api.cities.list({trip_id:trip.id})).toHaveLength(1)
    expect((await api.itinerary.list({trip_id:trip.id}))[0].title).toBe('抵达东京')
  })

  it('导出的 JSON 可清空后完整恢复',async()=>{
    const backup=await api.export()
    expect(backup.schema_version).toBe(1)
    expect(backup.cities[0].name).toBe('东京')
    await api.reset()
    expect(await api.cities.list()).toHaveLength(0)
    await api.import(backup)
    expect((await api.cities.list())[0].name).toBe('东京')
    expect((await api.itinerary.list())[0].title).toBe('抵达东京')
  })

  it('日程可关联多个预约，删除预约后会移除失效关联',async()=>{
    const [trip]=await api.trips.list()
    const reservation=(name:string)=>api.reservations.create({trip_id:trip.id,name,type:'车票',date:trip.start_date,time:null,status:'已预约',order_number:null,location:null,note:null,booking_url:null,map_url:null,image_url:null,city_id:null})
    const [first,second]=await Promise.all([reservation('东京到京都'),reservation('京都酒店')])
    const item=await api.itinerary.create({trip_id:trip.id,title:'转场日',date:trip.start_date,start_time:'12:00',end_time:null,type:'交通',location:null,note:null,reservation_id:first.id,reservation_ids:[first.id,second.id],place_id:null,map_url:null,image_url:null,city_id:null})
    expect((await api.itinerary.list({trip_id:trip.id})).find(value=>value.id===item.id)?.reservation_ids).toEqual([first.id,second.id])
    await api.reservations.remove(first.id)
    const updated=(await api.itinerary.list({trip_id:trip.id})).find(value=>value.id===item.id)
    expect(updated?.reservation_ids).toEqual([second.id])
    expect(updated?.reservation_id).toBe(second.id)
  })

  it('日程可关联具体灵感帖子，删除帖子后会移除失效关联',async()=>{
    const [trip]=await api.trips.list()
    const inspiration=await api.inspirations.create({trip_id:trip.id,title:'东京车站便当攻略',platform:'小红书',url:'https://example.com/tokyo',tags:['美食'],related_place:'东京站',note:null,image_url:null,favorite:true})
    const item=(await api.itinerary.list({trip_id:trip.id})).find(value=>value.title==='转场日')!
    const {id:_,...payload}=item
    await api.itinerary.update(item.id,{...payload,inspiration_id:inspiration.id})
    expect((await api.itinerary.list({trip_id:trip.id})).find(value=>value.id===item.id)?.inspiration_id).toBe(inspiration.id)
    await api.inspirations.remove(inspiration.id)
    expect((await api.itinerary.list({trip_id:trip.id})).find(value=>value.id===item.id)?.inspiration_id).toBeNull()
  })

  it('附件校验失败时保留现有数据',async()=>{
    const [trip]=await api.trips.list()
    const reservation=await api.reservations.create({trip_id:trip.id,name:'测试车票',type:'车票',date:trip.start_date,time:null,status:'已预约',order_number:null,location:null,note:null,booking_url:null,map_url:null,image_url:null,city_id:null})
    const payload=await api.export()
    const zip=new JSZip()
    zip.file('travel-planner.json',JSON.stringify({...payload,reservation_attachments:[{id:1,reservation_id:reservation.id,original_name:'broken.pdf',archive_path:'attachments/broken.pdf'}]}))
    zip.file('attachments/broken.pdf','not a pdf')
    const archive=await zip.generateAsync({type:'blob'})
    await expect(api.importArchive(new File([archive],'broken.zip',{type:'application/zip'}))).rejects.toThrow('附件不是有效 PDF')
    expect((await api.trips.list()).some(item=>item.id===trip.id)).toBe(true)
    expect((await api.reservations.list({trip_id:trip.id})).some(item=>item.id===reservation.id)).toBe(true)
  })
})
