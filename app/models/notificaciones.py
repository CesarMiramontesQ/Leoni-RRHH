from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Notificacion(Base):
    __tablename__ = "notificaciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    destinatario_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(
        Enum("email", "in_app", name="notificacion_tipo_enum"),
        nullable=False,
        default="in_app",
    )
    asunto: Mapped[str] = mapped_column(String(255), nullable=False)
    cuerpo: Mapped[str] = mapped_column(Text, nullable=False)
    leida: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    enviada: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    destinatario = relationship("Empleado", foreign_keys=[destinatario_id])

    def __repr__(self) -> str:
        return f"<Notificacion id={self.id} tipo={self.tipo} leida={self.leida}>"
