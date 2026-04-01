from typing import TYPE_CHECKING

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class Rol(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    # Valid values: empleado, supervisor, gerente, director, rh
    permisos: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    __table_args__ = (UniqueConstraint("nombre", name="uq_roles_nombre"),)

    # Relationships
    empleados: Mapped[list["Empleado"]] = relationship("Empleado", back_populates="rol")

    def __repr__(self) -> str:
        return f"<Rol id={self.id} nombre={self.nombre}>"
