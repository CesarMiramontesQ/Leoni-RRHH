"""Tablas propias del proyecto, separadas de ``empleados`` (tabla de Bono).

`empleados` vive en Bono y no se modifica: solo expone identidad y atributos de
Bono. Todo lo que el proyecto necesita y Bono NO tiene vive aquí, 1:1 con el
empleado y keyed por ``empleado_id`` (PK de Bono):

- ``levelup_empleados_core``       rol y credenciales del proyecto.
- ``levelup_empleados_config``     fecha fin contrato + permisos por módulo RH.
- ``levelup_empleados_permisos``   flags de administración RH / horas extra.
- ``levelup_empleados_horas_extra`` auditoría de autorización de horas extra.

El modelo ``Empleado`` expone propiedades de compatibilidad (``rol``,
``password_hash``, ``modulos_rh``, etc.) que delegan a estas tablas; el correo
oficial se lee de ``empleados.email`` (Bono). Las escrituras RH se hacen vía
los helpers ``ensure_*``.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, func
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.security import SYNC_PLACEHOLDER_PASSWORD_HASH

if TYPE_CHECKING:
    from app.models.empleados import Empleado
    from app.models.roles import Rol


class EmpleadoCore(Base):
    """Datos propios del proyecto que Bono.empleados no tiene (rol, credenciales)."""

    __tablename__ = "levelup_empleados_core"

    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id", ondelete="CASCADE"), primary_key=True
    )
    rol_id: Mapped[int] = mapped_column(ForeignKey("levelup_roles.id"), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado", back_populates="core", foreign_keys=[empleado_id]
    )
    rol: Mapped["Rol"] = relationship("Rol", back_populates="empleados", lazy="selectin")


class EmpleadoRhConfig(Base):
    __tablename__ = "levelup_empleados_config"

    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id", ondelete="CASCADE"), primary_key=True
    )
    fecha_fin_contrato: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    modulos_rh: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    inscrito_modulos_rh: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    acceso_rh_removido: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado", back_populates="rh_config", foreign_keys=[empleado_id]
    )


class EmpleadoRhPermisos(Base):
    __tablename__ = "levelup_empleados_permisos"

    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id", ondelete="CASCADE"), primary_key=True
    )
    puede_administrar_permisos_rh: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    puede_registrar_horas_extra: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado", back_populates="rh_permisos", foreign_keys=[empleado_id]
    )


class EmpleadoRhHorasExtra(Base):
    __tablename__ = "levelup_empleados_horas_extra"

    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id", ondelete="CASCADE"), primary_key=True
    )
    autorizado_en: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    autorizado_por_empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado", back_populates="rh_horas_extra", foreign_keys=[empleado_id]
    )
    autorizado_por: Mapped[Optional["Empleado"]] = relationship(
        "Empleado", foreign_keys=[autorizado_por_empleado_id]
    )


# ── Helpers get-or-create (la fila hija puede no existir aún) ──────────────────
# Evitan lazy-load async: si la relación no está cargada (empleado recién creado),
# se asume sin fila hija y se crea. Para empleados cargados por query las
# relaciones core/rh_* son selectin (ya cargadas).

def _current_child(empleado: "Empleado", attr: str):
    if attr in sa_inspect(empleado).unloaded:
        return None
    return getattr(empleado, attr)


def ensure_core(db: AsyncSession, empleado: "Empleado") -> EmpleadoCore:
    core = _current_child(empleado, "core")
    if core is None:
        core = EmpleadoCore(
            empleado_id=empleado.empleado_id,
            password_hash=SYNC_PLACEHOLDER_PASSWORD_HASH,
        )
        db.add(core)
        empleado.core = core
    return core


def ensure_rh_config(db: AsyncSession, empleado: "Empleado") -> EmpleadoRhConfig:
    cfg = _current_child(empleado, "rh_config")
    if cfg is None:
        cfg = EmpleadoRhConfig(empleado_id=empleado.empleado_id)
        db.add(cfg)
        empleado.rh_config = cfg
    return cfg


def ensure_rh_permisos(db: AsyncSession, empleado: "Empleado") -> EmpleadoRhPermisos:
    permisos = _current_child(empleado, "rh_permisos")
    if permisos is None:
        permisos = EmpleadoRhPermisos(empleado_id=empleado.empleado_id)
        db.add(permisos)
        empleado.rh_permisos = permisos
    return permisos


def ensure_rh_horas_extra(db: AsyncSession, empleado: "Empleado") -> EmpleadoRhHorasExtra:
    he = _current_child(empleado, "rh_horas_extra")
    if he is None:
        he = EmpleadoRhHorasExtra(empleado_id=empleado.empleado_id)
        db.add(he)
        empleado.rh_horas_extra = he
    return he
