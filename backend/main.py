from contextlib import asynccontextmanager
from datetime import date, datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import crud
from database import Base, SessionLocal, engine, get_db
from models import City, Expense, Inspiration, ItineraryItem, Place, Reservation, RouteLeg, TripInfo
from schemas import (
    CityCreate, CityRead, ExpenseCreate, ExpenseRead, ExportPayload, ImportResult,
    InspirationCreate, InspirationRead, ItineraryCreate, ItineraryRead, PlaceCreate, PlaceRead,
    ReservationCreate, ReservationRead, RouteLegCreate, RouteLegRead, TripBase, TripRead,
)
from seed import migrate_existing_city_data, seed_database


def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)
    # create_all 不会修改既有 SQLite 表；这里为旧数据库做轻量、幂等迁移。
    table_additions = {
        "expenses": {"currency": "VARCHAR(3) NOT NULL DEFAULT 'CNY'"},
        "places": {
            "city_id": "INTEGER REFERENCES cities(id) ON DELETE SET NULL",
            "latitude": "NUMERIC(9, 6)", "longitude": "NUMERIC(9, 6)",
        },
        "itinerary_items": {"city_id": "INTEGER REFERENCES cities(id) ON DELETE SET NULL"},
        "reservations": {"city_id": "INTEGER REFERENCES cities(id) ON DELETE SET NULL"},
    }
    existing_tables = set(inspect(engine).get_table_names())
    with engine.begin() as connection:
        for table_name, additions in table_additions.items():
            if table_name not in existing_tables:
                continue
            columns = {column["name"] for column in inspect(engine).get_columns(table_name)}
            for column_name, definition in additions.items():
                if column_name not in columns:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))
    with SessionLocal() as db:
        seed_database(db)
        migrate_existing_city_data(db)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="Travel Planner API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/trip", response_model=TripRead)
def get_trip(db: Session = Depends(get_db)):
    trip = db.scalar(select(TripInfo).limit(1))
    if trip is None:
        raise HTTPException(404, "旅行设置不存在")
    return trip


@app.put("/api/trip", response_model=TripRead)
def update_trip(payload: TripBase, db: Session = Depends(get_db)):
    trip = db.scalar(select(TripInfo).limit(1))
    if trip is None:
        trip = TripInfo(id=1, **payload.model_dump())
        db.add(trip)
        db.commit()
        db.refresh(trip)
        return trip
    return crud.update_item(db, trip, payload)


@app.get("/api/cities", response_model=list[CityRead])
def get_cities(db: Session = Depends(get_db)):
    return crud.list_items(db, City, City.order_index, City.id)


@app.post("/api/cities", response_model=CityRead, status_code=201)
def create_city(payload: CityCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, City, payload)


@app.put("/api/cities/{item_id}", response_model=CityRead)
def update_city(item_id: int, payload: CityCreate, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, City, item_id), payload)


@app.delete("/api/cities/{item_id}", status_code=204)
def delete_city(item_id: int, db: Session = Depends(get_db)):
    crud.delete_item(db, crud.get_or_404(db, City, item_id))
    return Response(status_code=204)


@app.get("/api/itinerary", response_model=list[ItineraryRead])
def get_itinerary(
    item_type: str | None = Query(None, alias="type"),
    item_date: date | None = Query(None, alias="date"),
    city_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(ItineraryItem)
    if item_type:
        query = query.where(ItineraryItem.type == item_type)
    if item_date:
        query = query.where(ItineraryItem.date == item_date)
    if city_id:
        query = query.where(ItineraryItem.city_id == city_id)
    return list(db.scalars(query.order_by(ItineraryItem.date, ItineraryItem.start_time, ItineraryItem.id)))


@app.post("/api/itinerary", response_model=ItineraryRead, status_code=status.HTTP_201_CREATED)
def create_itinerary(payload: ItineraryCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, ItineraryItem, payload)


@app.put("/api/itinerary/{item_id}", response_model=ItineraryRead)
def update_itinerary(item_id: int, payload: ItineraryCreate, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, ItineraryItem, item_id), payload)


@app.delete("/api/itinerary/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_itinerary(item_id: int, db: Session = Depends(get_db)):
    crud.delete_item(db, crud.get_or_404(db, ItineraryItem, item_id))
    return Response(status_code=204)


@app.get("/api/reservations", response_model=list[ReservationRead])
def get_reservations(
    item_type: str | None = Query(None, alias="type"),
    item_status: str | None = Query(None, alias="status"),
    city_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(Reservation)
    if item_type:
        query = query.where(Reservation.type == item_type)
    if item_status:
        query = query.where(Reservation.status == item_status)
    if city_id:
        query = query.where(Reservation.city_id == city_id)
    return list(db.scalars(query.order_by(Reservation.date, Reservation.time, Reservation.id)))


@app.post("/api/reservations", response_model=ReservationRead, status_code=201)
def create_reservation(payload: ReservationCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, Reservation, payload)


@app.put("/api/reservations/{item_id}", response_model=ReservationRead)
def update_reservation(item_id: int, payload: ReservationCreate, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, Reservation, item_id), payload)


@app.delete("/api/reservations/{item_id}", status_code=204)
def delete_reservation(item_id: int, db: Session = Depends(get_db)):
    crud.delete_item(db, crud.get_or_404(db, Reservation, item_id))
    return Response(status_code=204)


@app.get("/api/inspirations", response_model=list[InspirationRead])
def get_inspirations(tag: str | None = None, favorite: bool | None = None, db: Session = Depends(get_db)):
    query = select(Inspiration)
    if favorite is not None:
        query = query.where(Inspiration.favorite == favorite)
    items = list(db.scalars(query.order_by(Inspiration.favorite.desc(), Inspiration.id.desc())))
    return [item for item in items if not tag or tag in (item.tags or [])]


@app.post("/api/inspirations", response_model=InspirationRead, status_code=201)
def create_inspiration(payload: InspirationCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, Inspiration, payload)


@app.put("/api/inspirations/{item_id}", response_model=InspirationRead)
def update_inspiration(item_id: int, payload: InspirationCreate, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, Inspiration, item_id), payload)


@app.delete("/api/inspirations/{item_id}", status_code=204)
def delete_inspiration(item_id: int, db: Session = Depends(get_db)):
    crud.delete_item(db, crud.get_or_404(db, Inspiration, item_id))
    return Response(status_code=204)


@app.get("/api/places", response_model=list[PlaceRead])
def get_places(item_type: str | None = Query(None, alias="type"), city_id: int | None = None, db: Session = Depends(get_db)):
    query = select(Place)
    if item_type:
        query = query.where(Place.type == item_type)
    if city_id:
        query = query.where(Place.city_id == city_id)
    return list(db.scalars(query.order_by(Place.city, Place.name, Place.id)))


@app.post("/api/places", response_model=PlaceRead, status_code=201)
def create_place(payload: PlaceCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, Place, payload)


@app.put("/api/places/{item_id}", response_model=PlaceRead)
def update_place(item_id: int, payload: PlaceCreate, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, Place, item_id), payload)


@app.delete("/api/places/{item_id}", status_code=204)
def delete_place(item_id: int, db: Session = Depends(get_db)):
    crud.delete_item(db, crud.get_or_404(db, Place, item_id))
    return Response(status_code=204)


@app.get("/api/route-legs", response_model=list[RouteLegRead])
def get_route_legs(db: Session = Depends(get_db)):
    return crud.list_items(db, RouteLeg, RouteLeg.order_index, RouteLeg.id)


@app.post("/api/route-legs", response_model=RouteLegRead, status_code=201)
def create_route_leg(payload: RouteLegCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, RouteLeg, payload)


@app.put("/api/route-legs/{item_id}", response_model=RouteLegRead)
def update_route_leg(item_id: int, payload: RouteLegCreate, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, RouteLeg, item_id), payload)


@app.delete("/api/route-legs/{item_id}", status_code=204)
def delete_route_leg(item_id: int, db: Session = Depends(get_db)):
    crud.delete_item(db, crud.get_or_404(db, RouteLeg, item_id))
    return Response(status_code=204)


@app.get("/api/expenses", response_model=list[ExpenseRead])
def get_expenses(category: str | None = None, expense_date: date | None = Query(None, alias="date"), db: Session = Depends(get_db)):
    query = select(Expense)
    if category:
        query = query.where(Expense.category == category)
    if expense_date:
        query = query.where(Expense.date == expense_date)
    return list(db.scalars(query.order_by(Expense.date.desc(), Expense.id.desc())))


@app.post("/api/expenses", response_model=ExpenseRead, status_code=201)
def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, Expense, payload)


@app.put("/api/expenses/{item_id}", response_model=ExpenseRead)
def update_expense(item_id: int, payload: ExpenseCreate, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, Expense, item_id), payload)


@app.delete("/api/expenses/{item_id}", status_code=204)
def delete_expense(item_id: int, db: Session = Depends(get_db)):
    crud.delete_item(db, crud.get_or_404(db, Expense, item_id))
    return Response(status_code=204)


def build_export(db: Session) -> ExportPayload:
    trip = db.scalar(select(TripInfo).limit(1))
    if trip is None:
        raise HTTPException(404, "旅行设置不存在")
    return ExportPayload(
        exported_at=datetime.now(timezone.utc), trip=trip,
        itinerary=crud.list_items(db, ItineraryItem, ItineraryItem.date, ItineraryItem.start_time),
        reservations=crud.list_items(db, Reservation, Reservation.date, Reservation.time),
        inspirations=crud.list_items(db, Inspiration, Inspiration.id),
        places=crud.list_items(db, Place, Place.id),
        expenses=crud.list_items(db, Expense, Expense.date, Expense.id),
        cities=crud.list_items(db, City, City.order_index, City.id),
        route_legs=crud.list_items(db, RouteLeg, RouteLeg.order_index, RouteLeg.id),
    )


@app.get("/api/export", response_model=ExportPayload)
def export_data(db: Session = Depends(get_db)):
    return build_export(db)


@app.post("/api/import", response_model=ImportResult)
def import_data(payload: ExportPayload, db: Session = Depends(get_db)):
    reservation_ids = {item.id for item in payload.reservations}
    place_ids = {item.id for item in payload.places}
    itinerary_ids = {item.id for item in payload.itinerary}
    city_ids = {item.id for item in payload.cities}
    for item in payload.itinerary:
        if item.reservation_id and item.reservation_id not in reservation_ids:
            raise HTTPException(400, f"日程 {item.id} 引用了不存在的预约")
        if item.place_id and item.place_id not in place_ids:
            raise HTTPException(400, f"日程 {item.id} 引用了不存在的地点")
        if item.city_id and item.city_id not in city_ids:
            raise HTTPException(400, f"日程 {item.id} 引用了不存在的城市")
    for item in payload.places:
        if item.city_id and item.city_id not in city_ids:
            raise HTTPException(400, f"地点 {item.id} 引用了不存在的城市")
    for item in payload.reservations:
        if item.city_id and item.city_id not in city_ids:
            raise HTTPException(400, f"预约 {item.id} 引用了不存在的城市")
    for item in payload.route_legs:
        if item.from_place_id not in place_ids or item.to_place_id not in place_ids:
            raise HTTPException(400, f"路线 {item.id} 引用了不存在的地点")
        if item.reservation_id and item.reservation_id not in reservation_ids:
            raise HTTPException(400, f"路线 {item.id} 引用了不存在的预约")
    for item in payload.expenses:
        if item.itinerary_id and item.itinerary_id not in itinerary_ids:
            raise HTTPException(400, f"消费 {item.id} 引用了不存在的日程")
        if item.reservation_id and item.reservation_id not in reservation_ids:
            raise HTTPException(400, f"消费 {item.id} 引用了不存在的预约")
    try:
        for model in (Expense, RouteLeg, ItineraryItem, Inspiration, Reservation, Place, City, TripInfo):
            db.execute(delete(model))
        db.add(TripInfo(**payload.trip.model_dump()))
        db.flush()
        db.add_all([City(**item.model_dump()) for item in payload.cities])
        db.flush()
        db.add_all([Place(**item.model_dump()) for item in payload.places])
        db.flush()
        db.add_all([Reservation(**item.model_dump()) for item in payload.reservations])
        db.flush()
        db.add_all([ItineraryItem(**item.model_dump()) for item in payload.itinerary])
        db.add_all([Inspiration(**item.model_dump()) for item in payload.inspirations])
        db.flush()
        db.add_all([Expense(**item.model_dump()) for item in payload.expenses])
        db.flush()
        db.add_all([RouteLeg(**item.model_dump()) for item in payload.route_legs])
        db.flush()
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(400, "导入数据存在重复 ID 或无效关联") from exc
    return ImportResult(
        message="数据导入成功",
        counts={
            "itinerary": len(payload.itinerary), "reservations": len(payload.reservations),
            "inspirations": len(payload.inspirations), "places": len(payload.places),
            "expenses": len(payload.expenses),
            "cities": len(payload.cities), "route_legs": len(payload.route_legs),
        },
    )


@app.delete("/api/reset", status_code=204)
def reset_data(db: Session = Depends(get_db)):
    for model in (Expense, RouteLeg, ItineraryItem, Inspiration, Reservation, Place, City, TripInfo):
        db.execute(delete(model))
    today = date.today()
    db.add(TripInfo(id=1, name="我的旅行", start_date=today, end_date=today, total_budget=0, currency="CNY"))
    db.commit()
    return Response(status_code=204)
