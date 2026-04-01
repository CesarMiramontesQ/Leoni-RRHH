from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ActaAdministrativa(Base):
    __tablename__ = "actas_administrativas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    incidencia_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("incidencias.id"), nullable=True
    )
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    contenido_ia: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contenido_final: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(
        Enum("draft", "pending_sign", "signed", "archived", name="acta_estado_enum"),
        nullable=False,
        default="draft",
    )
    generado_por: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    incidencia = relationship("Incidencia", foreign_keys=[incidencia_id])
    empleado = relationship("Empleado", foreign_keys=[empleado_id])
    generador = relationship("Empleado", foreign_keys=[generado_por])
    aprobaciones: Mapped[list["ActaAprobacion"]] = relationship(
        "ActaAprobacion", back_populates="acta"
    )

    def __repr__(self) -> str:
        return f"<ActaAdministrativa id={self.id} estado={self.estado}>"


class ActaAprobacion(Base):
    __tablename__ = "acta_aprobaciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    acta_id: Mapped[int] = mapped_column(ForeignKey("actas_administrativas.id"), nullable=False)
    firmante_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    rol_firmante: Mapped[str] = mapped_column(String(100), nullable=False)
    firma_timestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    comentario: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    acta: Mapped["ActaAdministrativa"] = relationship("ActaAdministrativa", back_populates="aprobaciones")
    firmante = relationship("Empleado", foreign_keys=[firmante_id])

    def __repr__(self) -> str:
        return f"<ActaAprobacion id={self.id} acta_id={self.acta_id}>"
