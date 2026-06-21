from datetime import date, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import City, Expense, Inspiration, ItineraryItem, Place, Reservation, RouteLeg, TripInfo


CITY_COORDINATES = {
    "京都": (Decimal("35.011600"), Decimal("135.768100")),
    "东京": (Decimal("35.676200"), Decimal("139.650300")),
    "東京": (Decimal("35.676200"), Decimal("139.650300")),
}


def seed_database(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(TripInfo)):
        return

    start = date.today() + timedelta(days=30)
    end = start + timedelta(days=7)
    trip = TripInfo(
        id=1,
        name="日本关西 · 东京 8 日游",
        start_date=start,
        end_date=end,
        total_budget=Decimal("18000.00"),
        currency="CNY",
    )
    db.add(trip)
    db.flush()

    kyoto_city = City(trip_id=1, name="京都", country="日本", order_index=0, arrival_date=start, departure_date=start + timedelta(days=3), latitude=Decimal("35.011600"), longitude=Decimal("135.768100"), note="关西古都与寺院散步")
    tokyo_city = City(trip_id=1, name="东京", country="日本", order_index=1, arrival_date=start + timedelta(days=3), departure_date=end, latitude=Decimal("35.676200"), longitude=Decimal("139.650300"), note="都市街区与下町体验")
    db.add_all([kyoto_city, tokyo_city])
    db.flush()

    kyoto_hotel = Place(
        name="京都站前酒店", type="酒店", city="京都", address="京都站步行约 5 分钟",
        map_url="https://maps.google.com/?q=Kyoto+Station", note="入住 3 晚，靠近交通枢纽",
        city_id=kyoto_city.id, latitude=Decimal("34.985849"), longitude=Decimal("135.758767")
    )
    tokyo_hotel = Place(
        name="浅草设计酒店", type="酒店", city="东京", address="浅草寺附近",
        map_url="https://maps.google.com/?q=Asakusa", note="入住 4 晚",
        city_id=tokyo_city.id, latitude=Decimal("35.714800"), longitude=Decimal("139.796700")
    )
    asakusa = Place(
        name="浅草寺", type="景点", city="东京", address="东京都台东区浅草 2-3-1",
        map_url="https://maps.google.com/?q=Sensoji", note="建议清晨前往",
        city_id=tokyo_city.id, latitude=Decimal("35.714765"), longitude=Decimal("139.796655")
    )
    kiyomizu_place = Place(
        name="清水寺", type="景点", city="京都", address="京都府京都市东山区清水 1-294",
        map_url="https://maps.google.com/?q=Kiyomizudera", note="从清水坂步行上山",
        city_id=kyoto_city.id, latitude=Decimal("34.994856"), longitude=Decimal("135.785046")
    )
    db.add_all([kyoto_hotel, tokyo_hotel, asakusa, kiyomizu_place])
    db.flush()

    shinkansen = Reservation(
        name="京都 → 东京新干线", type="车票", date=start + timedelta(days=3), time=time(10, 30),
        status="已预约", order_number="JR-DEMO-2026", location="京都站",
        booking_url="https://www.jreast.co.jp/", map_url="https://maps.google.com/?q=Kyoto+Station",
        note="提前 30 分钟到站"
        , city_id=kyoto_city.id
    )
    kiyomizu = Reservation(
        name="清水寺特别参观", type="景点", date=start + timedelta(days=1), time=time(9, 0),
        status="已预约", order_number="KYO-0521", location="清水寺",
        booking_url="https://www.kiyomizudera.or.jp/", map_url="https://maps.google.com/?q=Kiyomizudera"
        , city_id=kyoto_city.id
    )
    arashiyama = Reservation(
        name="岚山嵯峨野小火车", type="车票", date=start + timedelta(days=2), time=time(11, 0),
        status="待预约", location="嵯峨岚山站", booking_url="https://www.sagano-kanko.co.jp/",
        note="开放预约后尽快购买靠窗座位"
        , city_id=kyoto_city.id
    )
    db.add_all([shinkansen, kiyomizu, arashiyama])
    db.flush()

    items = [
        ItineraryItem(title="抵达京都，办理入住", date=start, start_time=time(15, 0), end_time=time(16, 0), type="酒店", location=kyoto_hotel.name, place_id=kyoto_hotel.id, map_url=kyoto_hotel.map_url, city_id=kyoto_city.id),
        ItineraryItem(title="清水寺与二年坂散步", date=start + timedelta(days=1), start_time=time(9, 0), end_time=time(12, 0), type="景点", location="清水寺", reservation_id=kiyomizu.id, place_id=kiyomizu_place.id, map_url=kiyomizu.map_url, city_id=kyoto_city.id),
        ItineraryItem(title="乘坐新干线前往东京", date=start + timedelta(days=3), start_time=time(10, 30), end_time=time(13, 0), type="交通", location="京都站", reservation_id=shinkansen.id, map_url=shinkansen.map_url, city_id=kyoto_city.id),
        ItineraryItem(title="浅草寺晨间散步", date=start + timedelta(days=4), start_time=time(7, 30), end_time=time(9, 0), type="景点", location=asakusa.name, place_id=asakusa.id, map_url=asakusa.map_url, city_id=tokyo_city.id),
    ]
    db.add_all(items)
    db.flush()

    db.add(Inspiration(
        title="京都小众散步路线收藏", platform="小红书", url="https://www.xiaohongshu.com/explore",
        tags=["京都", "散步", "拍照"], related_place="祇园", note="整理到日程前再确认营业时间", favorite=True
    ))
    db.add_all([
        Expense(title="往返机票", amount=Decimal("4280.00"), currency="CNY", date=start - timedelta(days=20), category="交通", payment_method="信用卡", note="上海往返东京", is_split=False),
        Expense(title="便利店补给", amount=Decimal("1450.00"), currency="JPY", date=start, category="餐饮", payment_method="现金", note="水和早餐", is_split=True, itinerary_id=items[0].id),
    ])
    db.add_all([
        RouteLeg(title="京都站前酒店 → 清水寺", from_place_id=kyoto_hotel.id, to_place_id=kiyomizu_place.id, transport_modes=["公共交通", "出租车", "骑行"], selected_mode="公共交通", duration_minutes=30, order_index=0, note="避开早高峰"),
        RouteLeg(title="京都 → 东京", from_place_id=kyoto_hotel.id, to_place_id=tokyo_hotel.id, transport_modes=["火车", "大巴", "飞机"], selected_mode="火车", duration_minutes=150, reservation_id=shinkansen.id, order_index=1, note="已预约东海道新干线"),
        RouteLeg(title="浅草酒店 → 浅草寺", from_place_id=tokyo_hotel.id, to_place_id=asakusa.id, transport_modes=["步行", "公共交通", "出租车"], selected_mode="步行", duration_minutes=8, order_index=2),
    ])
    db.commit()


def migrate_existing_city_data(db: Session) -> None:
    """把旧版自由文本城市迁移到新的旅程 → 城市层级，保持幂等。"""
    if not db.scalar(select(func.count()).select_from(TripInfo)):
        return
    cities = list(db.scalars(select(City).order_by(City.order_index, City.id)))
    if not cities:
        names = [name for name in db.scalars(select(Place.city).distinct()) if name]
        for index, name in enumerate(names):
            lat, lng = CITY_COORDINATES.get(name, (None, None))
            db.add(City(trip_id=1, name=name, country="日本", order_index=index, latitude=lat, longitude=lng))
        db.flush()
        cities = list(db.scalars(select(City).order_by(City.order_index, City.id)))
    city_by_name = {city.name: city for city in cities}
    known_places = {
        "京都站前酒店": (Decimal("34.985849"), Decimal("135.758767")),
        "浅草设计酒店": (Decimal("35.714800"), Decimal("139.796700")),
        "浅草寺": (Decimal("35.714765"), Decimal("139.796655")),
        "清水寺": (Decimal("34.994856"), Decimal("135.785046")),
    }
    for place in db.scalars(select(Place)):
        if not place.city_id and place.city in city_by_name:
            place.city_id = city_by_name[place.city].id
        if place.name in known_places and (place.latitude is None or place.longitude is None):
            place.latitude, place.longitude = known_places[place.name]
    for reservation in db.scalars(select(Reservation)):
        if reservation.city_id:
            continue
        text_value = f"{reservation.location or ''} {reservation.name}"
        for name, city in city_by_name.items():
            if name in text_value or (name == "东京" and "東京" in text_value):
                reservation.city_id = city.id
                break
    db.flush()
    for item in db.scalars(select(ItineraryItem)):
        if item.city_id:
            continue
        if item.place_id:
            place = db.get(Place, item.place_id)
            if place and place.city_id:
                item.city_id = place.city_id
                continue
        if item.reservation_id:
            reservation = db.get(Reservation, item.reservation_id)
            if reservation and reservation.city_id:
                item.city_id = reservation.city_id
    if not db.scalar(select(func.count()).select_from(RouteLeg)):
        places_by_name = {place.name: place for place in db.scalars(select(Place))}
        reservations = list(db.scalars(select(Reservation)))
        shinkansen = next((item for item in reservations if "新干线" in item.name), None)
        kyoto_hotel = places_by_name.get("京都站前酒店")
        tokyo_hotel = places_by_name.get("浅草设计酒店")
        asakusa = places_by_name.get("浅草寺")
        if kyoto_hotel and tokyo_hotel:
            db.add(RouteLeg(title="京都 → 东京", from_place_id=kyoto_hotel.id, to_place_id=tokyo_hotel.id, transport_modes=["火车", "大巴", "飞机"], selected_mode="火车", duration_minutes=150, reservation_id=shinkansen.id if shinkansen else None, order_index=0, note="跨城市交通，可关联自己的车票预约"))
        if tokyo_hotel and asakusa:
            db.add(RouteLeg(title="浅草酒店 → 浅草寺", from_place_id=tokyo_hotel.id, to_place_id=asakusa.id, transport_modes=["步行", "公共交通", "出租车"], selected_mode="步行", duration_minutes=8, order_index=1))
    db.commit()
