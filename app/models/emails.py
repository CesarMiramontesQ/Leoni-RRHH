from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Email(Base):
    __tablename__ = "levelup_emails"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Relación por no_empleado. En Bono `empleados.no_empleado` no es único, así que
    # no hay FK declarativa (no se modifica empleados); se valida a nivel app.
    no_empleado: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
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

    empleado = relationship(
        "Empleado",
        back_populates="email_alterno",
        primaryjoin="Email.no_empleado == Empleado.no_empleado",
        foreign_keys="Email.no_empleado",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return f"<Email id={self.id} no_empleado={self.no_empleado} email={self.email}>"
