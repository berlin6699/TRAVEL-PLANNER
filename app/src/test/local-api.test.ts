import { beforeAll, describe, expect, it } from 'vitest'
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
})
