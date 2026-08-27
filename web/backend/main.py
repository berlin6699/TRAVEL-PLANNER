from contextlib import asynccontextmanager
import asyncio
from datetime import date, datetime, timezone
from io import BytesIO
import json
import os
from pathlib import Path
import shutil
import tempfile
from time import monotonic
from uuid import uuid4
from zipfile import BadZipFile, ZIP_DEFLATED, ZipFile

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pypdf import PdfReader
import httpx
from sqlalchemy import delete, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import crud
from database import Base, SessionLocal, engine, get_db
from models import ChecklistItem, City, Destination, Expense, Inspiration, ItineraryItem, Place, Reservation, ReservationAttachment, RouteLeg, TripInfo
from schemas import (
    ChecklistItemCreate, ChecklistItemRead, CityCreate, CityRead, DestinationCreate, DestinationRead, ExpenseCreate, ExpenseRead, ExportPayload, GeocodeResult, ImportResult,
    InspirationCreate, InspirationRead, ItineraryCreate, ItineraryRead, PlaceCreate, PlaceRead,
    ReservationAttachmentRead, ReservationCreate, ReservationRead, RouteLegCreate, RouteLegRead, TripBase, TripRead,
)
from seed import migrate_existing_city_data, seed_database


UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", Path(__file__).resolve().parent / "uploads"))
MAX_PDF_BYTES = 15 * 1024 * 1024
MAX_ARCHIVE_BYTES = 250 * 1024 * 1024
MAX_ARCHIVE_CONTENT_BYTES = 300 * 1024 * 1024
GEOCODING_URL = os.getenv("GEOCODING_URL", "https://nominatim.openstreetmap.org/search")
GEOCODING_USER_AGENT = os.getenv("GEOCODING_USER_AGENT", "TravelPlannerLocal/1.0 (self-hosted local travel planner)")
_geocode_cache: dict[str, tuple[float, list[dict]]] = {}
_geocode_lock = asyncio.Lock()
_last_geocode_request = 0.0


def remove_upload_files(stored_names: list[str]) -> None:
    for stored_name in stored_names:
        (UPLOAD_DIR / stored_name).unlink(missing_ok=True)


def validate_pdf_content(content: bytes) -> None:
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(413, "PDF 文件不能超过 15 MB")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(400, "文件不是有效的 PDF")
    try:
        reader = PdfReader(BytesIO(content))
        if len(reader.pages) < 1:
            raise ValueError("PDF 没有页面")
    except Exception as exc:
        raise HTTPException(400, "PDF 文件损坏或无法读取") from exc


def initialize_database() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    # create_all 不会修改既有 SQLite 表；这里为旧数据库做轻量、幂等迁移。
    table_additions = {
        "places": {
            "city_id": "INTEGER REFERENCES cities(id) ON DELETE SET NULL",
            "latitude": "NUMERIC(9, 6)", "longitude": "NUMERIC(9, 6)",
            "trip_id": "INTEGER REFERENCES trip_info(id) ON DELETE CASCADE",
        },
        "itinerary_items": {
            "city_id": "INTEGER REFERENCES cities(id) ON DELETE SET NULL",
            "trip_id": "INTEGER REFERENCES trip_info(id) ON DELETE CASCADE",
            "reservation_ids": "JSON NOT NULL DEFAULT '[]'",
            "inspiration_id": "INTEGER REFERENCES inspirations(id) ON DELETE SET NULL",
        },
        "reservations": {"city_id": "INTEGER REFERENCES cities(id) ON DELETE SET NULL", "trip_id": "INTEGER REFERENCES trip_info(id) ON DELETE CASCADE"},
        "inspirations": {"trip_id": "INTEGER REFERENCES trip_info(id) ON DELETE CASCADE"},
        "route_legs": {"trip_id": "INTEGER REFERENCES trip_info(id) ON DELETE CASCADE"},
        "cities": {"destination_id": "INTEGER REFERENCES destinations(id) ON DELETE SET NULL"},
        "expenses": {
            "currency": "VARCHAR(3) NOT NULL DEFAULT 'CNY'", "trip_id": "INTEGER REFERENCES trip_info(id) ON DELETE CASCADE",
            "original_amount": "NUMERIC(12, 2)", "original_currency": "VARCHAR(3)", "exchange_rate": "NUMERIC(12, 6)",
        },
        "checklist_items": {"trip_id": "INTEGER REFERENCES trip_info(id) ON DELETE CASCADE"},
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
        for table_name in ("places", "itinerary_items", "reservations", "inspirations", "route_legs", "expenses", "checklist_items"):
            if table_name in existing_tables and "trip_id" in {column["name"] for column in inspect(engine).get_columns(table_name)}:
                connection.execute(text(f"UPDATE {table_name} SET trip_id = 1 WHERE trip_id IS NULL"))
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


async def fetch_geocode(query: str, limit: int) -> list[dict]:
    global _last_geocode_request
    cache_key = f"{query.casefold()}::{limit}"
    cached = _geocode_cache.get(cache_key)
    if cached and monotonic() - cached[0] < 86400:
        return cached[1]
    async with _geocode_lock:
        cached = _geocode_cache.get(cache_key)
        if cached and monotonic() - cached[0] < 86400:
            return cached[1]
        wait = 1.05 - (monotonic() - _last_geocode_request)
        if wait > 0:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=12, headers={"User-Agent": GEOCODING_USER_AGENT, "Accept-Language": "zh-CN,zh,en"}) as client:
                response = await client.get(GEOCODING_URL, params={"q": query, "format": "jsonv2", "addressdetails": 1, "limit": limit})
                response.raise_for_status()
                raw = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(503, "地点搜索服务暂时不可用，请稍后重试或手动填写坐标") from exc
        finally:
            _last_geocode_request = monotonic()
        results = [{
            "name": item.get("name") or str(item.get("display_name", "")).split(",")[0],
            "display_name": item.get("display_name", ""),
            "latitude": float(item["lat"]), "longitude": float(item["lon"]),
            "result_type": item.get("type"),
        } for item in raw if item.get("lat") and item.get("lon") and item.get("display_name")]
        _geocode_cache[cache_key] = (monotonic(), results)
        return results


@app.get("/api/geocode", response_model=list[GeocodeResult])
async def geocode(q: str = Query(min_length=2, max_length=160), limit: int = Query(default=5, ge=1, le=8)):
    return await fetch_geocode(q.strip(), limit)


@app.get("/api/trip", response_model=TripRead)
def get_trip(db: Session = Depends(get_db)):
    trip = db.scalar(select(TripInfo).limit(1))
    if trip is None:
        raise HTTPException(404, "旅行设置不存在")
    return trip


@app.get("/api/trips", response_model=list[TripRead])
def get_trips(db: Session = Depends(get_db)):
    return crud.list_items(db, TripInfo, TripInfo.start_date.desc(), TripInfo.id.desc())


@app.post("/api/trips", response_model=TripRead, status_code=201)
def create_trip(payload: TripBase, db: Session = Depends(get_db)):
    return crud.create_item(db, TripInfo, payload)


@app.put("/api/trips/{item_id}", response_model=TripRead)
def update_trip_by_id(item_id: int, payload: TripBase, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, TripInfo, item_id), payload)


@app.delete("/api/trips/{item_id}", status_code=204)
def delete_trip_by_id(item_id: int, db: Session = Depends(get_db)):
    trip = crud.get_or_404(db, TripInfo, item_id)
    stored_names = list(db.scalars(select(ReservationAttachment.stored_name).join(Reservation).where(Reservation.trip_id == item_id)))
    crud.delete_item(db, trip)
    remove_upload_files(stored_names)
    return Response(status_code=204)


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


@app.get("/api/destinations", response_model=list[DestinationRead])
def get_destinations(trip_id: int | None = None, db: Session = Depends(get_db)):
    query = select(Destination)
    if trip_id:
        query = query.where(Destination.trip_id == trip_id)
    return list(db.scalars(query.order_by(Destination.order_index, Destination.id)))


@app.post("/api/destinations", response_model=DestinationRead, status_code=201)
def create_destination(payload: DestinationCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, Destination, payload)


@app.put("/api/destinations/{item_id}", response_model=DestinationRead)
def update_destination(item_id: int, payload: DestinationCreate, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, Destination, item_id), payload)


@app.delete("/api/destinations/{item_id}", status_code=204)
def delete_destination(item_id: int, db: Session = Depends(get_db)):
    crud.delete_item(db, crud.get_or_404(db, Destination, item_id))
    return Response(status_code=204)


@app.get("/api/cities", response_model=list[CityRead])
def get_cities(trip_id: int | None = None, destination_id: int | None = None, db: Session = Depends(get_db)):
    query = select(City)
    if trip_id:
        query = query.where(City.trip_id == trip_id)
    if destination_id:
        query = query.where(City.destination_id == destination_id)
    return list(db.scalars(query.order_by(City.arrival_date.is_(None), City.arrival_date, City.order_index, City.id)))


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
    trip_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(ItineraryItem)
    if item_type:
        query = query.where(ItineraryItem.type == item_type)
    if item_date:
        query = query.where(ItineraryItem.date == item_date)
    if city_id:
        query = query.where(ItineraryItem.city_id == city_id)
    if trip_id:
        query = query.where(ItineraryItem.trip_id == trip_id)
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
    trip_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(Reservation)
    if item_type:
        query = query.where(Reservation.type == item_type)
    if item_status:
        query = query.where(Reservation.status == item_status)
    if city_id:
        query = query.where(Reservation.city_id == city_id)
    if trip_id:
        query = query.where(Reservation.trip_id == trip_id)
    return list(db.scalars(query.order_by(Reservation.date, Reservation.time, Reservation.id)))


@app.post("/api/reservations", response_model=ReservationRead, status_code=201)
def create_reservation(payload: ReservationCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, Reservation, payload)


@app.put("/api/reservations/{item_id}", response_model=ReservationRead)
def update_reservation(item_id: int, payload: ReservationCreate, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, Reservation, item_id), payload)


@app.delete("/api/reservations/{item_id}", status_code=204)
def delete_reservation(item_id: int, db: Session = Depends(get_db)):
    reservation = crud.get_or_404(db, Reservation, item_id)
    stored_names = list(db.scalars(select(ReservationAttachment.stored_name).where(ReservationAttachment.reservation_id == item_id)))
    for itinerary_item in db.scalars(select(ItineraryItem)):
        linked_ids = [linked_id for linked_id in (itinerary_item.reservation_ids or []) if linked_id != item_id]
        if linked_ids != (itinerary_item.reservation_ids or []):
            itinerary_item.reservation_ids = linked_ids
            itinerary_item.reservation_id = linked_ids[0] if linked_ids else None
    crud.delete_item(db, reservation)
    remove_upload_files(stored_names)
    return Response(status_code=204)


@app.get("/api/reservation-attachments", response_model=list[ReservationAttachmentRead])
def get_reservation_attachments(trip_id: int | None = None, reservation_id: int | None = None, db: Session = Depends(get_db)):
    query = select(ReservationAttachment).join(Reservation)
    if trip_id:
        query = query.where(Reservation.trip_id == trip_id)
    if reservation_id:
        query = query.where(ReservationAttachment.reservation_id == reservation_id)
    return list(db.scalars(query.order_by(ReservationAttachment.uploaded_at.desc(), ReservationAttachment.id.desc())))


@app.post("/api/reservations/{reservation_id}/attachments", response_model=ReservationAttachmentRead, status_code=201)
async def upload_reservation_attachment(reservation_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    crud.get_or_404(db, Reservation, reservation_id)
    original_name = Path(file.filename or "ticket.pdf").name
    if not original_name.lower().endswith(".pdf"):
        raise HTTPException(400, "只支持上传 PDF 文件")
    content = await file.read(MAX_PDF_BYTES + 1)
    validate_pdf_content(content)
    stored_name = f"{uuid4().hex}.pdf"
    target = UPLOAD_DIR / stored_name
    try:
        target.write_bytes(content)
        attachment = ReservationAttachment(
            reservation_id=reservation_id, original_name=original_name, stored_name=stored_name,
            mime_type="application/pdf", size_bytes=len(content),
        )
        db.add(attachment)
        db.commit()
        db.refresh(attachment)
        return attachment
    except Exception:
        db.rollback()
        target.unlink(missing_ok=True)
        raise


@app.get("/api/reservation-attachments/{attachment_id}/file")
def view_reservation_attachment(attachment_id: int, db: Session = Depends(get_db)):
    attachment = crud.get_or_404(db, ReservationAttachment, attachment_id)
    path = UPLOAD_DIR / attachment.stored_name
    if not path.is_file():
        raise HTTPException(404, "PDF 文件不存在")
    return FileResponse(path, media_type="application/pdf", filename=attachment.original_name, content_disposition_type="inline")


@app.delete("/api/reservation-attachments/{attachment_id}", status_code=204)
def delete_reservation_attachment(attachment_id: int, db: Session = Depends(get_db)):
    attachment = crud.get_or_404(db, ReservationAttachment, attachment_id)
    stored_name = attachment.stored_name
    crud.delete_item(db, attachment)
    remove_upload_files([stored_name])
    return Response(status_code=204)


@app.get("/api/inspirations", response_model=list[InspirationRead])
def get_inspirations(tag: str | None = None, favorite: bool | None = None, trip_id: int | None = None, db: Session = Depends(get_db)):
    query = select(Inspiration)
    if favorite is not None:
        query = query.where(Inspiration.favorite == favorite)
    if trip_id:
        query = query.where(Inspiration.trip_id == trip_id)
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
def get_places(item_type: str | None = Query(None, alias="type"), city_id: int | None = None, trip_id: int | None = None, db: Session = Depends(get_db)):
    query = select(Place)
    if item_type:
        query = query.where(Place.type == item_type)
    if city_id:
        query = query.where(Place.city_id == city_id)
    if trip_id:
        query = query.where(Place.trip_id == trip_id)
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
def get_route_legs(trip_id: int | None = None, db: Session = Depends(get_db)):
    query = select(RouteLeg)
    if trip_id:
        query = query.where(RouteLeg.trip_id == trip_id)
    return list(db.scalars(query.order_by(RouteLeg.order_index, RouteLeg.id)))


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
def get_expenses(category: str | None = None, expense_date: date | None = Query(None, alias="date"), trip_id: int | None = None, db: Session = Depends(get_db)):
    query = select(Expense)
    if category:
        query = query.where(Expense.category == category)
    if expense_date:
        query = query.where(Expense.date == expense_date)
    if trip_id:
        query = query.where(Expense.trip_id == trip_id)
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


@app.get("/api/checklist", response_model=list[ChecklistItemRead])
def get_checklist(kind: str | None = None, completed: bool | None = None, trip_id: int | None = None, db: Session = Depends(get_db)):
    query = select(ChecklistItem)
    if kind:
        query = query.where(ChecklistItem.kind == kind)
    if completed is not None:
        query = query.where(ChecklistItem.completed == completed)
    if trip_id:
        query = query.where(ChecklistItem.trip_id == trip_id)
    return list(db.scalars(query.order_by(ChecklistItem.completed, ChecklistItem.order_index, ChecklistItem.id)))


@app.post("/api/checklist", response_model=ChecklistItemRead, status_code=201)
def create_checklist_item(payload: ChecklistItemCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, ChecklistItem, payload)


@app.put("/api/checklist/{item_id}", response_model=ChecklistItemRead)
def update_checklist_item(item_id: int, payload: ChecklistItemCreate, db: Session = Depends(get_db)):
    return crud.update_item(db, crud.get_or_404(db, ChecklistItem, item_id), payload)


@app.delete("/api/checklist/{item_id}", status_code=204)
def delete_checklist_item(item_id: int, db: Session = Depends(get_db)):
    crud.delete_item(db, crud.get_or_404(db, ChecklistItem, item_id))
    return Response(status_code=204)


def build_export(db: Session) -> ExportPayload:
    trips = crud.list_items(db, TripInfo, TripInfo.id)
    if not trips:
        raise HTTPException(404, "旅行设置不存在")
    return ExportPayload(
        exported_at=datetime.now(timezone.utc), trip=trips[0], trips=trips,
        destinations=crud.list_items(db, Destination, Destination.trip_id, Destination.order_index, Destination.id),
        itinerary=crud.list_items(db, ItineraryItem, ItineraryItem.date, ItineraryItem.start_time),
        reservations=crud.list_items(db, Reservation, Reservation.date, Reservation.time),
        inspirations=crud.list_items(db, Inspiration, Inspiration.id),
        places=crud.list_items(db, Place, Place.id),
        expenses=crud.list_items(db, Expense, Expense.date, Expense.id),
        cities=crud.list_items(db, City, City.order_index, City.id),
        route_legs=crud.list_items(db, RouteLeg, RouteLeg.order_index, RouteLeg.id),
        checklist=crud.list_items(db, ChecklistItem, ChecklistItem.completed, ChecklistItem.order_index, ChecklistItem.id),
    )


@app.get("/api/export", response_model=ExportPayload)
def export_data(db: Session = Depends(get_db)):
    return build_export(db)


@app.get("/api/export/archive")
def export_archive(db: Session = Depends(get_db)):
    payload = build_export(db).model_dump(mode="json")
    attachments = list(db.scalars(select(ReservationAttachment).order_by(ReservationAttachment.id)))
    manifest_attachments = []
    buffer = BytesIO()
    with ZipFile(buffer, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for attachment in attachments:
            path = UPLOAD_DIR / attachment.stored_name
            if not path.is_file():
                continue
            archive_path = f"attachments/{attachment.id}-{Path(attachment.original_name).name}"
            archive.write(path, archive_path)
            manifest_attachments.append({
                "id": attachment.id,
                "reservation_id": attachment.reservation_id,
                "original_name": attachment.original_name,
                "mime_type": attachment.mime_type,
                "size_bytes": attachment.size_bytes,
                "uploaded_at": attachment.uploaded_at.isoformat(),
                "archive_path": archive_path,
            })
        payload["reservation_attachments"] = manifest_attachments
        archive.writestr("travel-planner.json", json.dumps(payload, ensure_ascii=False, indent=2))
    filename = f"travel-planner-full-{date.today().isoformat()}.zip"
    return Response(
        content=buffer.getvalue(), media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def replace_data(payload: ExportPayload, db: Session, *, commit: bool = True, remove_old_uploads: bool = True) -> ImportResult:
    old_uploads = list(db.scalars(select(ReservationAttachment.stored_name)))
    trips_to_import = payload.trips or [payload.trip]
    trip_ids = {item.id for item in trips_to_import}
    reservation_ids = {item.id for item in payload.reservations}
    inspiration_ids = {item.id for item in payload.inspirations}
    place_ids = {item.id for item in payload.places}
    itinerary_ids = {item.id for item in payload.itinerary}
    city_ids = {item.id for item in payload.cities}
    destination_ids = {item.id for item in payload.destinations}
    reservation_trips = {item.id: item.trip_id for item in payload.reservations}
    inspiration_trips = {item.id: item.trip_id for item in payload.inspirations}
    place_trips = {item.id: item.trip_id for item in payload.places}
    itinerary_trips = {item.id: item.trip_id for item in payload.itinerary}
    city_trips = {item.id: item.trip_id for item in payload.cities}
    destination_trips = {item.id: item.trip_id for item in payload.destinations}
    for item in payload.destinations:
        if item.trip_id not in trip_ids:
            raise HTTPException(400, f"目的地 {item.id} 引用了不存在的旅程")
        if item.parent_id and item.parent_id not in destination_ids:
            raise HTTPException(400, f"目的地 {item.id} 引用了不存在的上级地区")
        if item.parent_id and destination_trips[item.parent_id] != item.trip_id:
            raise HTTPException(400, f"目的地 {item.id} 引用了其他旅程的上级地区")
    for item in payload.cities:
        if item.trip_id not in trip_ids:
            raise HTTPException(400, f"城市 {item.id} 引用了不存在的旅程")
        if item.destination_id and item.destination_id not in destination_ids:
            raise HTTPException(400, f"城市 {item.id} 引用了不存在的国家或地区")
        if item.destination_id and destination_trips[item.destination_id] != item.trip_id:
            raise HTTPException(400, f"城市 {item.id} 引用了其他旅程的国家或地区")
    for item in payload.itinerary:
        if item.trip_id not in trip_ids:
            raise HTTPException(400, f"日程 {item.id} 引用了不存在的旅程")
        if item.reservation_id and item.reservation_id not in reservation_ids:
            raise HTTPException(400, f"日程 {item.id} 引用了不存在的预约")
        if any(reservation_id not in reservation_ids for reservation_id in item.reservation_ids):
            raise HTTPException(400, f"日程 {item.id} 引用了不存在的预约")
        if any(reservation_trips[reservation_id] != item.trip_id for reservation_id in item.reservation_ids):
            raise HTTPException(400, f"日程 {item.id} 引用了其他旅程的预约")
        if item.inspiration_id and item.inspiration_id not in inspiration_ids:
            raise HTTPException(400, f"日程 {item.id} 引用了不存在的灵感")
        if item.inspiration_id and inspiration_trips[item.inspiration_id] != item.trip_id:
            raise HTTPException(400, f"日程 {item.id} 引用了其他旅程的灵感")
        if item.place_id and item.place_id not in place_ids:
            raise HTTPException(400, f"日程 {item.id} 引用了不存在的地点")
        if item.place_id and place_trips[item.place_id] != item.trip_id:
            raise HTTPException(400, f"日程 {item.id} 引用了其他旅程的地点")
        if item.city_id and item.city_id not in city_ids:
            raise HTTPException(400, f"日程 {item.id} 引用了不存在的城市")
        if item.city_id and city_trips[item.city_id] != item.trip_id:
            raise HTTPException(400, f"日程 {item.id} 引用了其他旅程的城市")
    for item in payload.places:
        if item.trip_id not in trip_ids:
            raise HTTPException(400, f"地点 {item.id} 引用了不存在的旅程")
        if item.city_id and item.city_id not in city_ids:
            raise HTTPException(400, f"地点 {item.id} 引用了不存在的城市")
        if item.city_id and city_trips[item.city_id] != item.trip_id:
            raise HTTPException(400, f"地点 {item.id} 引用了其他旅程的城市")
    for item in payload.reservations:
        if item.trip_id not in trip_ids:
            raise HTTPException(400, f"预约 {item.id} 引用了不存在的旅程")
        if item.city_id and item.city_id not in city_ids:
            raise HTTPException(400, f"预约 {item.id} 引用了不存在的城市")
        if item.city_id and city_trips[item.city_id] != item.trip_id:
            raise HTTPException(400, f"预约 {item.id} 引用了其他旅程的城市")
    for item in payload.route_legs:
        if item.trip_id not in trip_ids:
            raise HTTPException(400, f"路线 {item.id} 引用了不存在的旅程")
        if item.from_place_id not in place_ids or item.to_place_id not in place_ids:
            raise HTTPException(400, f"路线 {item.id} 引用了不存在的地点")
        if place_trips[item.from_place_id] != item.trip_id or place_trips[item.to_place_id] != item.trip_id:
            raise HTTPException(400, f"路线 {item.id} 引用了其他旅程的地点")
        if item.reservation_id and item.reservation_id not in reservation_ids:
            raise HTTPException(400, f"路线 {item.id} 引用了不存在的预约")
        if item.reservation_id and reservation_trips[item.reservation_id] != item.trip_id:
            raise HTTPException(400, f"路线 {item.id} 引用了其他旅程的预约")
    for item in payload.inspirations:
        if item.trip_id not in trip_ids:
            raise HTTPException(400, f"灵感 {item.id} 引用了不存在的旅程")
    for item in payload.expenses:
        if item.trip_id not in trip_ids:
            raise HTTPException(400, f"消费 {item.id} 引用了不存在的旅程")
        if item.itinerary_id and item.itinerary_id not in itinerary_ids:
            raise HTTPException(400, f"消费 {item.id} 引用了不存在的日程")
        if item.itinerary_id and itinerary_trips[item.itinerary_id] != item.trip_id:
            raise HTTPException(400, f"消费 {item.id} 引用了其他旅程的日程")
        if item.reservation_id and item.reservation_id not in reservation_ids:
            raise HTTPException(400, f"消费 {item.id} 引用了不存在的预约")
        if item.reservation_id and reservation_trips[item.reservation_id] != item.trip_id:
            raise HTTPException(400, f"消费 {item.id} 引用了其他旅程的预约")
    for item in payload.checklist:
        if item.trip_id not in trip_ids:
            raise HTTPException(400, f"清单 {item.id} 引用了不存在的旅程")
    try:
        for model in (ChecklistItem, Expense, RouteLeg, ItineraryItem, Inspiration, ReservationAttachment, Reservation, Place, City, Destination, TripInfo):
            db.execute(delete(model))
        db.add_all([TripInfo(**item.model_dump()) for item in trips_to_import])
        db.flush()
        db.add_all([Destination(**item.model_dump()) for item in payload.destinations])
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
        db.add_all([ChecklistItem(**item.model_dump()) for item in payload.checklist])
        db.flush()
        if commit:
            db.commit()
            if remove_old_uploads:
                try:
                    remove_upload_files(old_uploads)
                except OSError:
                    # The restore succeeded; stale orphan files can be cleaned later.
                    pass
        else:
            db.flush()
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
            "trips": len(trips_to_import), "destinations": len(payload.destinations),
            "checklist": len(payload.checklist),
        },
    )


@app.post("/api/import", response_model=ImportResult)
def import_data(payload: ExportPayload, db: Session = Depends(get_db)):
    return replace_data(payload, db)


@app.post("/api/import/archive", response_model=ImportResult)
async def import_archive(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(400, "请选择 Travel Planner 导出的 ZIP 备份")
    raw = await file.read(MAX_ARCHIVE_BYTES + 1)
    if len(raw) > MAX_ARCHIVE_BYTES:
        raise HTTPException(413, "完整备份 ZIP 不能超过 250 MB")
    staging_dir = Path(tempfile.mkdtemp(prefix="import-", dir=UPLOAD_DIR))
    staged: list[dict] = []
    moved_files: list[str] = []
    old_uploads = list(db.scalars(select(ReservationAttachment.stored_name)))
    try:
        try:
            archive = ZipFile(BytesIO(raw), "r")
        except BadZipFile as exc:
            raise HTTPException(400, "ZIP 备份已损坏") from exc
        with archive:
            infos = archive.infolist()
            if len(infos) > 1000 or sum(info.file_size for info in infos) > MAX_ARCHIVE_CONTENT_BYTES:
                raise HTTPException(413, "ZIP 解压后的内容过大")
            for info in infos:
                path = Path(info.filename)
                if path.is_absolute() or ".." in path.parts:
                    raise HTTPException(400, "ZIP 包含不安全的文件路径")
            try:
                manifest = json.loads(archive.read("travel-planner.json"))
                payload = ExportPayload.model_validate(manifest)
            except KeyError as exc:
                raise HTTPException(400, "ZIP 中缺少 travel-planner.json") from exc
            except Exception as exc:
                raise HTTPException(400, "备份数据格式无效") from exc
            reservation_ids = {item.id for item in payload.reservations}
            seen_paths: set[str] = set()
            for item in manifest.get("reservation_attachments", []):
                reservation_id = int(item.get("reservation_id", 0))
                archive_path = str(item.get("archive_path", ""))
                original_name = Path(str(item.get("original_name", "ticket.pdf"))).name
                if reservation_id not in reservation_ids or not archive_path or archive_path in seen_paths:
                    raise HTTPException(400, "PDF 附件清单包含无效关联")
                seen_paths.add(archive_path)
                try:
                    content = archive.read(archive_path)
                except KeyError as exc:
                    raise HTTPException(400, f"ZIP 中缺少附件：{original_name}") from exc
                validate_pdf_content(content)
                staged_name = f"{uuid4().hex}.pdf"
                (staging_dir / staged_name).write_bytes(content)
                try:
                    uploaded_at = datetime.fromisoformat(str(item.get("uploaded_at", "")))
                except ValueError:
                    uploaded_at = datetime.utcnow()
                staged.append({
                    "reservation_id": reservation_id, "original_name": original_name,
                    "stored_name": staged_name, "mime_type": "application/pdf",
                    "size_bytes": len(content), "uploaded_at": uploaded_at,
                })
        result = replace_data(payload, db, commit=False, remove_old_uploads=False)
        try:
            records = []
            for item in staged:
                source = staging_dir / item["stored_name"]
                target = UPLOAD_DIR / item["stored_name"]
                source.replace(target)
                moved_files.append(item["stored_name"])
                records.append(ReservationAttachment(**item))
            db.add_all(records)
            db.commit()
        except Exception:
            db.rollback()
            remove_upload_files(moved_files)
            raise HTTPException(500, "备份恢复失败，原数据已保留")
        try:
            remove_upload_files(old_uploads)
        except OSError:
            # Do not report failure after the database and new files committed.
            pass
        result.counts["attachments"] = len(staged)
        return result
    finally:
        shutil.rmtree(staging_dir, ignore_errors=True)


@app.delete("/api/reset", status_code=204)
def reset_data(db: Session = Depends(get_db)):
    old_uploads = list(db.scalars(select(ReservationAttachment.stored_name)))
    for model in (ChecklistItem, Expense, RouteLeg, ItineraryItem, Inspiration, ReservationAttachment, Reservation, Place, City, Destination, TripInfo):
        db.execute(delete(model))
    today = date.today()
    db.add(TripInfo(id=1, name="我的旅行", start_date=today, end_date=today, total_budget=0, currency="CNY"))
    db.commit()
    remove_upload_files(old_uploads)
    return Response(status_code=204)
