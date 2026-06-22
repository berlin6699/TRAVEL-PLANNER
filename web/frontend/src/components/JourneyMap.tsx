import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import type { City, Place, RouteLeg } from '../types'

function FitMap({ points }: { points: [number,number][] }) {
  const map=useMap()
  useEffect(()=>{if(points.length===1)map.setView(points[0],12);else if(points.length>1)map.fitBounds(points as LatLngBoundsExpression,{padding:[35,35]})},[map,points])
  return null
}

export default function JourneyMap({ cities, places, routes, activeCityId, onRouteClick }: { cities: City[]; places: Place[]; routes: RouteLeg[]; activeCityId: number|null; onRouteClick: (route: RouteLeg)=>void }) {
  const visiblePlaces=places.filter(x=>!activeCityId||x.city_id===activeCityId).filter(x=>x.latitude!=null&&x.longitude!=null)
  const visibleIds=new Set(visiblePlaces.map(x=>x.id)), visibleRoutes=routes.filter(x=>visibleIds.has(x.from_place_id)&&visibleIds.has(x.to_place_id))
  const cityPoints=cities.filter(x=>(!activeCityId||x.id===activeCityId)&&x.latitude!=null&&x.longitude!=null)
  const points:[number,number][]=visiblePlaces.map(x=>[Number(x.latitude),Number(x.longitude)])
  if(!points.length)points.push(...cityPoints.map(x=>[Number(x.latitude),Number(x.longitude)] as [number,number]))
  const placeById=new Map(places.map(x=>[x.id,x]))
  if(!points.length)return <div className="flex h-[460px] items-center justify-center rounded-3xl bg-stone-100 px-8 text-center text-sm text-stone-500">为城市或地点补充经纬度后，就会在这里出现相对位置和路线。</div>
  return <MapContainer className="h-[460px] w-full rounded-3xl" center={points[0]} zoom={activeCityId?12:5} scrollWheelZoom>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
    <FitMap points={points}/>
    {cityPoints.map(city=><CircleMarker key={`city-${city.id}`} center={[Number(city.latitude),Number(city.longitude)]} radius={11} pathOptions={{color:'#292824',fillColor:'#ff7a61',fillOpacity:.95,weight:3}}><Tooltip permanent direction="top" offset={[0,-10]}>{city.name}</Tooltip><Popup><b>{city.name}</b><br/>{city.country||'未填写国家'}<br/>{city.note||''}</Popup></CircleMarker>)}
    {visiblePlaces.map(place=><CircleMarker key={place.id} center={[Number(place.latitude),Number(place.longitude)]} radius={7} pathOptions={{color:'#fff',fillColor:'#36a986',fillOpacity:1,weight:3}}><Tooltip direction="top">{place.name}</Tooltip><Popup><b>{place.name}</b><br/>{place.type} · {place.address||place.city||''}</Popup></CircleMarker>)}
    {visibleRoutes.map(route=>{const from=placeById.get(route.from_place_id),to=placeById.get(route.to_place_id);if(!from?.latitude||!from.longitude||!to?.latitude||!to.longitude)return null;return <Polyline key={route.id} positions={[[Number(from.latitude),Number(from.longitude)],[Number(to.latitude),Number(to.longitude)]]} pathOptions={{color:'#ff7a61',weight:6,opacity:.8,dashArray:route.selected_mode==='步行'?'5 9':undefined}} eventHandlers={{click:()=>onRouteClick(route)}}><Tooltip sticky>{route.title}<br/>点击查看交通方式</Tooltip></Polyline>})}
  </MapContainer>
}

