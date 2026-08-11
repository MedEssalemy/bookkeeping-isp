from app import crud
from app.schemas import schemas
from app.routers.factory import build_crud_router

router = build_crud_router(
    prefix="/invoices",
    tags=["invoices"],
    crud_obj=crud.invoice,
    read_schema=schemas.InvoiceRead,
    create_schema=schemas.InvoiceCreate,
    update_schema=schemas.InvoiceUpdate,
)
