"""
Generic CRUD helpers shared by every router, so each entity router only
has to declare its model + schemas, not reimplement list/get/create/update/delete.
"""
from typing import Type, TypeVar, Generic
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status
from pydantic import BaseModel

ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: int) -> ModelType:
        obj = db.get(self.model, id)
        if obj is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.model.__name__} with id={id} not found",
            )
        return obj

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100):
        stmt = select(self.model).offset(skip).limit(limit)
        return db.execute(stmt).scalars().all()

    def create(self, db: Session, obj_in: CreateSchemaType) -> ModelType:
        db_obj = self.model(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, id: int, obj_in: UpdateSchemaType) -> ModelType:
        db_obj = self.get(db, id)
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, id: int) -> None:
        db_obj = self.get(db, id)
        db.delete(db_obj)
        db.commit()
