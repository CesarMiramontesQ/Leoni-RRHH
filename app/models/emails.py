from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Email(Base):
    __tablename__ = "emails"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    no_empleado: Mapped[str] = mapped_column(
        String(50), ForeignKey("empleados.no_empleado"), nullable=False, unique=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    empleado = relationship("Empleado", back_populates="email_alterno")

    def __repr__(self) -> str:
        return f"<Email id={self.id} no_empleado={self.no_empleado} email={self.email}>"
