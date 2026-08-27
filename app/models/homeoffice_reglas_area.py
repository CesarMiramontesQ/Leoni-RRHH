"""Regla de home office por área: «N días cada M semanas».

Es la única fuente de elegibilidad por área para solicitar home office (junto con la
clasificación Administrativo del empleado, que sigue hardcodeada en
``solicitud_service``). Un área sin fila, o con ``activo = False``, no puede pedir HO.

La edita RH desde «Configuración laborales» (`#/laborales/configuracion`). El cambio
aplica solo a solicitudes nuevas; nada se revalida hacia atrás. Las filas no se borran:
se apagan con ``activo`` para conservar el valor y el rastro.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.catalogos import Area
    from app.models.empleados import Empleado


class HomeOfficeReglaArea(Base):
    __tablename__ = "levelup_homeoffice_reglas_area"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    area_id: Mapped[int] = mapped_column(
        ForeignKey("areas.area_id"), nullable=False, unique=True
    )
    dias_permitidos: Mapped[int] = mapped_column(Integer, nullable=False)
    periodo_semanas: Mapped[int] = mapped_column(Integer, nullable=False)
    activo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
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

    area: Mapped["Area"] = relationship("Area")
    actualizado_por: Mapped[Optional["Empleado"]] = relationship(
        "Empleado", foreign_keys=[actualizado_por_empleado_id]
    )

    def __repr__(self) -> str:
        return (
            f"<HomeOfficeReglaArea area_id={self.area_id} "
            f"{self.dias_permitidos}/{self.periodo_semanas}sem activo={self.activo}>"
        )
