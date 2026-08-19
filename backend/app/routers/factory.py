"""
Factory that builds a standard CRUD APIRouter (list/get/create/update/delete)
for a given model + CRUD helper + schema set. Entity-specific routers import
this, get the standard routes for free, then add relationship-specific routes.
"""
from typing import Type
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import get_current_user, require_write_access


def build_crud_router(
    *,
    prefix: str,
    tags: list[str],
    crud_obj,
    read_schema: Type,
    create_schema: Type,
    update_schema: Type,
) -> APIRouter:
    """
    All routes require a valid Bearer token (401 if missing/invalid).
    Create/update/delete additionally require admin or editor role (403
    otherwise) — mirrors the frontend's canEdit/canDelete logic, enforced
    server-side since UI hiding alone isn't real access control.
    """
    router = APIRouter(prefix=prefix, tags=tags)

    @router.get("/", response_model=list[read_schema])
    def list_items(
        skip: int = 0, limit: int = 100,
        db: Session = Depends(get_db),
        _user=Depends(get_current_user),
    ):
        return crud_obj.get_multi(db, skip=skip, limit=limit)

    @router.get("/{item_id}", response_model=read_schema)
    def get_item(item_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
        return crud_obj.get(db, item_id)

    @router.post("/", response_model=read_schema, status_code=201)
    def create_item(item_in: create_schema, db: Session = Depends(get_db), _user=Depends(require_write_access)):
        return crud_obj.create(db, item_in)

    @router.patch("/{item_id}", response_model=read_schema)
    def update_item(
        item_id: int, item_in: update_schema,
        db: Session = Depends(get_db),
        _user=Depends(require_write_access),
    ):
        return crud_obj.update(db, item_id, item_in)

    @router.delete("/{item_id}", status_code=204)
    def delete_item(item_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
        crud_obj.delete(db, item_id)
        return None

    return router
