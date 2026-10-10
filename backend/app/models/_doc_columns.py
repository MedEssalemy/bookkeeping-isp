"""
Column helpers shared by the three document tables (proposals, purchase
orders, invoices). Each document carries the frontend's full flat shape
(see frontend/src/types/*.ts) — counterparty snapshot, tax/totals and the
line items as JSONB — on top of the ERD's relational links.
"""
from sqlalchemy import Column, String, Boolean, Numeric, Text, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB


def money():
    return Column(Numeric(14, 2), nullable=False, default=0, server_default="0")


def tax_rate():
    return Column(Numeric(8, 5), nullable=False, default=0, server_default="0")


def taxable():
    return Column(Boolean, nullable=False, default=False, server_default="false")


def line_items():
    return Column(JSONB, nullable=False, default=list, server_default="[]")


def opt_str(length: int = 255):
    return Column(String(length), nullable=True)


def text():
    return Column(Text, nullable=True)


def created_at():
    return Column(DateTime(timezone=True), nullable=False, server_default=func.now())


def updated_at():
    return Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
