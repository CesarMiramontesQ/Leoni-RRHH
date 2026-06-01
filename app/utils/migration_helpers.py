"""Utilidades compartidas para migraciones Alembic idempotentes en producción."""

from __future__ import annotations

from alembic import op
from sqlalchemy import inspect


def table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {col["name"] for col in inspector.get_columns(table_name)}


def constraint_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_unique_constraints(table_name)}


def foreign_key_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {fk["name"] for fk in inspector.get_foreign_keys(table_name) if fk.get("name")}


def column_type(table_name: str, column_name: str) -> str | None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if table_name not in inspector.get_table_names():
        return None
    for col in inspector.get_columns(table_name):
        if col["name"] == column_name:
            return type(col["type"]).__name__
    return None
