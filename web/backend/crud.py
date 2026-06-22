from typing import TypeVar

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


ModelT = TypeVar("ModelT")


def get_or_404(db: Session, model: type[ModelT], item_id: int) -> ModelT:
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    return item


def list_items(db: Session, model: type[ModelT], *order_by) -> list[ModelT]:
    statement = select(model)
    if order_by:
        statement = statement.order_by(*order_by)
    return list(db.scalars(statement).all())


def create_item(db: Session, model: type[ModelT], payload) -> ModelT:
    item = model(**payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="关联的记录不存在或数据存在冲突") from exc
    db.refresh(item)
    return item


def update_item(db: Session, item: ModelT, payload) -> ModelT:
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="关联的记录不存在或数据存在冲突") from exc
    db.refresh(item)
    return item


def delete_item(db: Session, item: ModelT) -> None:
    db.delete(item)
    db.commit()
