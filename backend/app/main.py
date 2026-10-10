from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.spa import mount_spa
from app.routers import (
    auth,
    clients,
    subcontractors,
    proposals,
    purchase_orders,
    invoices,
    jobs,
    references,
    config_lists,
    tax_rates,
    attachments,
)

app = FastAPI(
    title="Bookkeeping Project API",
    description="Backend for the client/subcontractor/proposal/PO/invoice/job ERD",
    version="0.1.0",
)

# CORS is left open to the (future) frontend dev servers listed in settings.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ~2 MB of JS bundle and the larger list responses shrink to roughly a third.
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(clients.router, prefix=settings.api_prefix)
app.include_router(subcontractors.router, prefix=settings.api_prefix)
app.include_router(proposals.router, prefix=settings.api_prefix)
app.include_router(purchase_orders.router, prefix=settings.api_prefix)
app.include_router(invoices.router, prefix=settings.api_prefix)
app.include_router(jobs.router, prefix=settings.api_prefix)
app.include_router(references.router, prefix=settings.api_prefix)
app.include_router(config_lists.router, prefix=settings.api_prefix)
app.include_router(tax_rates.router, prefix=settings.api_prefix)
# Last: its /{module}/{record_id}/attachments pattern is the most generic.
app.include_router(attachments.router, prefix=settings.api_prefix)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "version": settings.app_version}


# Last: the UI's catch-all route must come after every API route.
if settings.static_dir:
    mount_spa(app, settings.static_dir, settings.api_prefix)
