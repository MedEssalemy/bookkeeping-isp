from app import crud
from app.schemas import schemas
from app.routers.factory import build_crud_router

router = build_crud_router(
    prefix="/references",
    tags=["references"],
    crud_obj=crud.reference_doc,
    read_schema=schemas.ReferenceDocRead,
    create_schema=schemas.ReferenceDocCreate,
    update_schema=schemas.ReferenceDocUpdate,
)
