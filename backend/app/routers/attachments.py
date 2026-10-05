"""
Attachments on received documents — matches frontend/src/api/attachments.ts.
Files are stored in Postgres (bytea); fine for the expected volume.
"""
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Attachment, Proposal, PurchaseOrder, Invoice
from app.security import get_current_user, require_write_access

router = APIRouter(tags=["attachments"])

MODULES = {"proposals": Proposal, "pos": PurchaseOrder, "invoices": Invoice}
MAX_BYTES = 25 * 1024 * 1024


def serialize(a: Attachment) -> dict:
    return {
        "id": str(a.id),
        "file_name": a.file_name,
        "size_bytes": a.size_bytes,
        "mime_type": a.mime_type,
        "uploaded_at": a.uploaded_at.isoformat(),
    }


def _record_id(db: Session, module: str, record_id: str) -> int:
    model = MODULES.get(module)
    if model is None:
        raise HTTPException(status_code=404, detail={"message": "Unknown module"})
    try:
        rid = int(record_id)
    except ValueError:
        rid = None
    if rid is None or db.get(model, rid) is None:
        raise HTTPException(status_code=404, detail={"message": "Record not found"})
    return rid


def _get(db: Session, attachment_id: str) -> Attachment:
    try:
        a = db.get(Attachment, int(attachment_id))
    except ValueError:
        a = None
    if a is None:
        raise HTTPException(status_code=404, detail={"message": "Attachment not found"})
    return a


@router.get("/{module}/{record_id}/attachments")
def list_attachments(module: str, record_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    rid = _record_id(db, module, record_id)
    rows = db.execute(
        select(Attachment).where(Attachment.module == module, Attachment.record_id == rid).order_by(Attachment.id)
    ).scalars()
    return [serialize(a) for a in rows]


@router.post("/{module}/{record_id}/attachments", status_code=201)
async def add_attachment(
    module: str, record_id: str, file: UploadFile = File(...),
    db: Session = Depends(get_db), _user=Depends(require_write_access),
):
    rid = _record_id(db, module, record_id)
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail={"message": "File is larger than 25 MB"})
    a = Attachment(
        module=module, record_id=rid, file_name=file.filename or "file",
        mime_type=file.content_type or "application/octet-stream", size_bytes=len(data), data=data,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return serialize(a)


@router.delete("/attachments/{attachment_id}")
def delete_attachment(attachment_id: str, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    a = _get(db, attachment_id)
    db.delete(a)
    db.commit()
    return {"id": attachment_id}


@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    a = _get(db, attachment_id)
    return Response(
        content=a.data,
        media_type=a.mime_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(a.file_name)}"},
    )
