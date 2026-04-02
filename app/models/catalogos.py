from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class Area(Base):
    __tablename__ = "areas"

    area_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)

    subareas: Mapped[List["Subarea"]] = relationship("Subarea", back_populates="area")
    puestos: Mapped[List["Puesto"]] = relationship("Puesto", back_populates="area")
    empleados: Mapped[List["Empleado"]] = relationship("Empleado", back_populates="area")


class Subarea(Base):
    __tablename__ = "subareas"

    subarea_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    area_id: Mapped[int] = mapped_column(ForeignKey("areas.area_id"), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)

    area: Mapped["Area"] = relationship("Area", back_populates="subareas")
    empleados: Mapped[List["Empleado"]] = relationship("Empleado", back_populates="subarea")


class Categoria(Base):
    __tablename__ = "categorias"

    categoria_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nivel: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bono_cat: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    descripcion: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)

    empleados: Mapped[List["Empleado"]] = relationship("Empleado", back_populates="categoria")


class Puesto(Base):
    __tablename__ = "puestos"

    puesto_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True
    )

    area: Mapped[Optional["Area"]] = relationship("Area", back_populates="puestos")
    empleados: Mapped[List["Empleado"]] = relationship("Empleado", back_populates="puesto")


class EstadoEmpleado(Base):
    __tablename__ = "estados_empleados"

    estado_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)

    empleados: Mapped[List["Empleado"]] = relationship("Empleado", back_populates="estado")


class ClasificacionEmpleado(Base):
    __tablename__ = "clasificacion_empleado"

    clasificacion_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(150), nullable=False)
    estatus_id: Mapped[int] = mapped_column(Integer, nullable=False)
    significado: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    empleados: Mapped[List["Empleado"]] = relationship(
        "Empleado", back_populates="clasificacion"
    )
