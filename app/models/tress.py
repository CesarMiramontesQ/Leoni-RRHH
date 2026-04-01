from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TressRobotQueue(Base):
    __tablename__ = "tress_robot_queue"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    accion: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    estado: Mapped[str] = mapped_column(
        Enum("pending", "done", "error", "retrying", name="tress_queue_estado_enum"),
        nullable=False,
        default="pending",
    )
    intentos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_msg: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<TressRobotQueue id={self.id} accion={self.accion} estado={self.estado}>"
