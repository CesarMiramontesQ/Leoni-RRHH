from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    accion: Mapped[str] = mapped_column(String(100), nullable=False)
    modulo: Mapped[str] = mapped_column(String(100), nullable=False)
    entidad_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    datos_antes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    datos_despues: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    usuario = relationship("Empleado", foreign_keys=[usuario_id])

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} accion={self.accion} modulo={self.modulo}>"


class ItSyncLog(Base):
    __tablename__ = "it_sync_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    operacion: Mapped[str] = mapped_column(
        Enum("insert", "update", "deactivate", name="it_sync_operacion_enum"),
        nullable=False,
    )
    empleado_id: Mapped[str] = mapped_column(String(50), nullable=False)
    datos: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    sincronizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[str] = mapped_column(
        Enum("ok", "error", name="it_sync_status_enum"),
        nullable=False,
        default="ok",
    )
    error_msg: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<ItSyncLog id={self.id} operacion={self.operacion} status={self.status}>"


class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"

    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    def __repr__(self) -> str:
        return f"<TokenBlacklist jti={self.jti}>"
