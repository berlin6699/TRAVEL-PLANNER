from __future__ import annotations

from datetime import date as dt_date, datetime, time as dt_time
from decimal import Decimal
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator


ItineraryType = Literal["交通", "酒店", "景点", "餐饮", "购物", "其他"]
ReservationType = Literal["酒店", "车票", "机票", "景点", "餐厅", "其他"]
ReservationStatus = Literal["已预约", "待预约", "已完成", "已取消"]
PlatformType = Literal["小红书", "公众号", "网页", "其他"]
PlaceType = Literal["酒店", "车站", "机场", "景点", "餐厅", "商场", "其他"]
ExpenseCategory = Literal["交通", "住宿", "餐饮", "门票", "购物", "其他"]
TransportMode = Literal["步行", "公共交通", "出租车", "自驾", "骑行", "火车", "大巴", "飞机", "轮渡", "其他"]
ChecklistKind = Literal["行李", "待办"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def validate_url(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("链接必须是有效的 http 或 https 地址")
    return value


class TripBase(ORMModel):
    name: str = Field(min_length=1, max_length=120)
    start_date: dt_date
    end_date: dt_date
    total_budget: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="CNY", min_length=3, max_length=3)

    @field_serializer("total_budget", when_used="json")
    def serialize_budget(self, value: Decimal) -> float:
        return float(value)

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, value: str) -> str:
        if not value.isalpha():
            raise ValueError("货币代码必须为 3 个字母")
        return value.upper()

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("结束日期不能早于开始日期")
        return self


class TripRead(TripBase):
    id: int


class DestinationBase(ORMModel):
    trip_id: int
    name: str = Field(min_length=1, max_length=100)
    type: Literal["国家", "地区"] = "国家"
    code: str | None = Field(default=None, max_length=10)
    order_index: int = Field(default=0, ge=0)
    parent_id: int | None = None
    note: str | None = None


class DestinationCreate(DestinationBase):
    pass


class DestinationRead(DestinationBase):
    id: int


class CityBase(ORMModel):
    trip_id: int = 1
    destination_id: int | None = None
    name: str = Field(min_length=1, max_length=100)
    country: str | None = None
    order_index: int = Field(default=0, ge=0)
    arrival_date: dt_date | None = None
    departure_date: dt_date | None = None
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)
    note: str | None = None

    @field_serializer("latitude", "longitude", when_used="json")
    def serialize_coordinates(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None

    @model_validator(mode="after")
    def validate_city_dates(self):
        if self.arrival_date and self.departure_date and self.departure_date < self.arrival_date:
            raise ValueError("离开日期不能早于抵达日期")
        return self


class CityCreate(CityBase):
    pass


class CityRead(CityBase):
    id: int


class ItineraryBase(ORMModel):
    trip_id: int = 1
    title: str = Field(min_length=1, max_length=160)
    date: dt_date
    start_time: dt_time
    end_time: dt_time | None = None
    type: ItineraryType
    location: str | None = None
    note: str | None = None
    reservation_id: int | None = None
    reservation_ids: list[int] = Field(default_factory=list)
    inspiration_id: int | None = None
    place_id: int | None = None
    map_url: str | None = None
    image_url: str | None = None
    city_id: int | None = None
    reminder_minutes: int | None = Field(default=None, ge=0, le=10080)

    _map_url = field_validator("map_url", "image_url", mode="before")(validate_url)

    @model_validator(mode="after")
    def validate_times(self):
        if self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("结束时间必须晚于开始时间")
        reservation_ids = [item for item in [*self.reservation_ids, self.reservation_id] if item is not None]
        self.reservation_ids = list(dict.fromkeys(reservation_ids))
        self.reservation_id = self.reservation_ids[0] if self.reservation_ids else None
        return self


class ItineraryCreate(ItineraryBase):
    pass


class ItineraryRead(ItineraryBase):
    id: int


class ReservationBase(ORMModel):
    trip_id: int = 1
    name: str = Field(min_length=1, max_length=160)
    type: ReservationType
    date: dt_date
    time: dt_time | None = None
    status: ReservationStatus
    order_number: str | None = None
    location: str | None = None
    note: str | None = None
    booking_url: str | None = None
    map_url: str | None = None
    image_url: str | None = None
    city_id: int | None = None

    _urls = field_validator("booking_url", "map_url", "image_url", mode="before")(validate_url)


class ReservationCreate(ReservationBase):
    pass


class ReservationRead(ReservationBase):
    id: int


class ReservationAttachmentRead(ORMModel):
    id: int
    reservation_id: int
    original_name: str
    mime_type: str
    size_bytes: int
    uploaded_at: datetime


class InspirationBase(ORMModel):
    trip_id: int = 1
    title: str = Field(min_length=1, max_length=160)
    platform: PlatformType
    url: str
    tags: list[str] = Field(default_factory=list)
    related_place: str | None = None
    note: str | None = None
    image_url: str | None = None
    favorite: bool = False

    _urls = field_validator("url", "image_url", mode="before")(validate_url)

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(tag.strip() for tag in value if tag.strip()))


class InspirationCreate(InspirationBase):
    pass


class InspirationRead(InspirationBase):
    id: int


class PlaceBase(ORMModel):
    trip_id: int = 1
    name: str = Field(min_length=1, max_length=160)
    type: PlaceType
    city: str | None = None
    address: str | None = None
    map_url: str | None = None
    note: str | None = None
    image_url: str | None = None
    city_id: int | None = None
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)

    _urls = field_validator("map_url", "image_url", mode="before")(validate_url)

    @field_serializer("latitude", "longitude", when_used="json")
    def serialize_coordinates(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None


class PlaceCreate(PlaceBase):
    pass


class PlaceRead(PlaceBase):
    id: int


class RouteLegBase(ORMModel):
    trip_id: int = 1
    title: str = Field(min_length=1, max_length=160)
    from_place_id: int
    to_place_id: int
    transport_modes: list[TransportMode] = Field(min_length=1)
    selected_mode: TransportMode | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=10080)
    reservation_id: int | None = None
    order_index: int = Field(default=0, ge=0)
    note: str | None = None

    @model_validator(mode="after")
    def validate_route(self):
        if self.from_place_id == self.to_place_id:
            raise ValueError("路线起点和终点不能相同")
        if self.selected_mode and self.selected_mode not in self.transport_modes:
            raise ValueError("当前交通方式必须包含在可选方式中")
        return self


class RouteLegCreate(RouteLegBase):
    pass


class RouteLegRead(RouteLegBase):
    id: int


class ExpenseBase(ORMModel):
    trip_id: int = 1
    title: str = Field(min_length=1, max_length=160)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="CNY", min_length=3, max_length=3)
    original_amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    original_currency: str | None = Field(default=None, min_length=3, max_length=3)
    exchange_rate: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=6)
    date: dt_date
    category: ExpenseCategory
    payment_method: str | None = None
    note: str | None = None
    is_split: bool = False
    itinerary_id: int | None = None
    reservation_id: int | None = None

    @field_serializer("amount", "original_amount", "exchange_rate", when_used="json")
    def serialize_amount(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None

    @field_validator("currency")
    @classmethod
    def expense_currency_upper(cls, value: str) -> str:
        if not value.isalpha():
            raise ValueError("货币代码必须为 3 个字母")
        return value.upper()

    @field_validator("original_currency")
    @classmethod
    def original_currency_upper(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.isalpha():
            raise ValueError("原币代码必须为 3 个字母")
        return value.upper()


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseRead(ExpenseBase):
    id: int


class ChecklistItemBase(ORMModel):
    trip_id: int = 1
    kind: ChecklistKind
    title: str = Field(min_length=1, max_length=160)
    category: str | None = Field(default=None, max_length=60)
    quantity: int = Field(default=1, ge=1, le=999)
    completed: bool = False
    due_date: dt_date | None = None
    note: str | None = None
    order_index: int = Field(default=0, ge=0)


class ChecklistItemCreate(ChecklistItemBase):
    pass


class ChecklistItemRead(ChecklistItemBase):
    id: int


class GeocodeResult(BaseModel):
    name: str
    display_name: str
    latitude: float
    longitude: float
    result_type: str | None = None


class ExportPayload(BaseModel):
    schema_version: Literal[1] = 1
    exported_at: datetime
    trip: TripRead
    itinerary: list[ItineraryRead]
    reservations: list[ReservationRead]
    inspirations: list[InspirationRead]
    places: list[PlaceRead]
    expenses: list[ExpenseRead]
    cities: list[CityRead] = Field(default_factory=list)
    route_legs: list[RouteLegRead] = Field(default_factory=list)
    trips: list[TripRead] = Field(default_factory=list)
    destinations: list[DestinationRead] = Field(default_factory=list)
    checklist: list[ChecklistItemRead] = Field(default_factory=list)


class ImportResult(BaseModel):
    message: str
    counts: dict[str, int]
