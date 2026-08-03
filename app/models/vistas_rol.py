"""Configuración de acceso a vistas por rol base (`empleado`, `supervisor`, `gerente`).

El catálogo de vistas vive en `app/core/vista_rol_registry.py`; aquí solo se persiste el
toggle por par (rol, vista). Una vista sin fila se considera apagada.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class VistaRol(Base):
    __tablename__ = "levelup_vistas_rol"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    rol_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_roles.id", ondelete="CASCADE"), nullable=False
    )
    vista_key: Mapped[str] = mapped_column(String(64), nullable=False)
    habilitado: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    actualizado_por_empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("rol_id", "vista_key", name="uq_levelup_vistas_rol_rol_vista"),
        Index("ix_levelup_vistas_rol_rol_id", "rol_id"),
    )

    def __repr__(self) -> str:
        return f"<VistaRol rol_id={self.rol_id} vista={self.vista_key} on={self.habilitado}>"
