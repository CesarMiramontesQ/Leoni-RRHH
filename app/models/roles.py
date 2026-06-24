from typing import TYPE_CHECKING

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados_rh import EmpleadoCore


class Rol(Base):
    __tablename__ = "levelup_roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    # Valid values: empleado, supervisor, gerente, director, rh
    permisos: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    __table_args__ = (UniqueConstraint("nombre", name="uq_levelup_roles_nombre"),)

    # El rol del empleado vive en levelup_empleados_core (no en empleados de Bono).
    empleados: Mapped[list["EmpleadoCore"]] = relationship(
        "EmpleadoCore", back_populates="rol"
    )

    def __repr__(self) -> str:
        return f"<Rol id={self.id} nombre={self.nombre}>"
