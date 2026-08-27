from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class TripInfo(Base):
    __tablename__ = "trip_info"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    start_date: Mapped[object] = mapped_column(Date)
    end_date: Mapped[object] = mapped_column(Date)
    total_budget: Mapped[object] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="CNY")


class Destination(Base):
    __tablename__ = "destinations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip_info.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20), default="国家")
    code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("destinations.id", ondelete="SET NULL"), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class City(Base):
    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip_info.id", ondelete="CASCADE"), default=1, index=True)
    destination_id: Mapped[int | None] = mapped_column(ForeignKey("destinations.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    arrival_date: Mapped[object | None] = mapped_column(Date, nullable=True)
    departure_date: Mapped[object | None] = mapped_column(Date, nullable=True)
    latitude: Mapped[object | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[object | None] = mapped_column(Numeric(9, 6), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip_info.id", ondelete="CASCADE"), default=1, index=True)
    title: Mapped[str] = mapped_column(String(160))
    date: Mapped[object] = mapped_column(Date, index=True)
    start_time: Mapped[object] = mapped_column(Time)
    end_time: Mapped[object | None] = mapped_column(Time, nullable=True)
    type: Mapped[str] = mapped_column(String(20), index=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reservation_id: Mapped[int | None] = mapped_column(
        ForeignKey("reservations.id", ondelete="SET NULL"), nullable=True
    )
    reservation_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    inspiration_id: Mapped[int | None] = mapped_column(
        ForeignKey("inspirations.id", ondelete="SET NULL"), nullable=True
    )
    place_id: Mapped[int | None] = mapped_column(
        ForeignKey("places.id", ondelete="SET NULL"), nullable=True
    )
    map_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    city_id: Mapped[int | None] = mapped_column(ForeignKey("cities.id", ondelete="SET NULL"), nullable=True, index=True)
    reminder_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip_info.id", ondelete="CASCADE"), default=1, index=True)
    name: Mapped[str] = mapped_column(String(160))
    type: Mapped[str] = mapped_column(String(20), index=True)
    date: Mapped[object] = mapped_column(Date, index=True)
    time: Mapped[object | None] = mapped_column(Time, nullable=True)
    status: Mapped[str] = mapped_column(String(20), index=True)
    order_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    booking_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    map_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    city_id: Mapped[int | None] = mapped_column(ForeignKey("cities.id", ondelete="SET NULL"), nullable=True, index=True)


class ReservationAttachment(Base):
    __tablename__ = "reservation_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reservation_id: Mapped[int] = mapped_column(ForeignKey("reservations.id", ondelete="CASCADE"), index=True)
    original_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(80), unique=True)
    mime_type: Mapped[str] = mapped_column(String(80), default="application/pdf")
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Inspiration(Base):
    __tablename__ = "inspirations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip_info.id", ondelete="CASCADE"), default=1, index=True)
    title: Mapped[str] = mapped_column(String(160))
    platform: Mapped[str] = mapped_column(String(20), index=True)
    url: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    related_place: Mapped[str | None] = mapped_column(String(160), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip_info.id", ondelete="CASCADE"), default=1, index=True)
    name: Mapped[str] = mapped_column(String(160))
    type: Mapped[str] = mapped_column(String(20), index=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    address: Mapped[str | None] = mapped_column(String(240), nullable=True)
    map_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    city_id: Mapped[int | None] = mapped_column(ForeignKey("cities.id", ondelete="SET NULL"), nullable=True, index=True)
    latitude: Mapped[object | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[object | None] = mapped_column(Numeric(9, 6), nullable=True)


class RouteLeg(Base):
    __tablename__ = "route_legs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip_info.id", ondelete="CASCADE"), default=1, index=True)
    title: Mapped[str] = mapped_column(String(160))
    from_place_id: Mapped[int] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    to_place_id: Mapped[int] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    transport_modes: Mapped[list[str]] = mapped_column(JSON, default=list)
    selected_mode: Mapped[str | None] = mapped_column(String(30), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reservation_id: Mapped[int | None] = mapped_column(ForeignKey("reservations.id", ondelete="SET NULL"), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip_info.id", ondelete="CASCADE"), default=1, index=True)
    title: Mapped[str] = mapped_column(String(160))
    amount: Mapped[object] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="CNY")
    original_amount: Mapped[object | None] = mapped_column(Numeric(12, 2), nullable=True)
    original_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    exchange_rate: Mapped[object | None] = mapped_column(Numeric(12, 6), nullable=True)
    date: Mapped[object] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    payment_method: Mapped[str | None] = mapped_column(String(60), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_split: Mapped[bool] = mapped_column(Boolean, default=False)
    itinerary_id: Mapped[int | None] = mapped_column(
        ForeignKey("itinerary_items.id", ondelete="SET NULL"), nullable=True
    )
    reservation_id: Mapped[int | None] = mapped_column(
        ForeignKey("reservations.id", ondelete="SET NULL"), nullable=True
    )


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip_info.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20), index=True)
    title: Mapped[str] = mapped_column(String(160))
    category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    due_date: Mapped[object | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
