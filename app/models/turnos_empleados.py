from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class TurnoEmpleado(Base):
    """Turno/comedor por número de empleado (`empleados.no_empleado`).

    El turno lo escribe ``app.services.sync_turnos_empleados_service`` desde
    ``dbo.COLABORA`` (``CB_TURNO`` de los activos); la asignación de comedor es dato
    propio de la app y el sync **no la toca**.

    ``tu_codigo`` es lo que hace calculable la rotación: apunta al catálogo
    (``levelup_turnos``), de donde salen ``tu_rit_pat`` y ``tu_rit_ini``. La columna
    ``turno``, de texto libre, se conserva porque hay consumidores previos que la leen;
    el sync escribe ambas con el mismo valor normalizado para que no se separen.

    Una baja se marca con ``activo = False`` en lugar de borrarse: la fila conserva el
    comedor asignado por si la persona reingresa, y permite distinguir «causó baja» de
    «nunca se sincronizó».
    """

    __tablename__ = "levelup_turnos_empleados"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Relación por no_empleado; sin FK declarativa (en Bono no_empleado no es único
    # y empleados no se modifica). Validación a nivel app.
    # En BD es varchar (listados TRESS / Excel); empleados.no_empleado es integer.
    no_empleado: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    clasificacion: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    comedor: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    turno: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # Sin FK a levelup_turnos, por el mismo motivo que levelup_turnos_uso: TRESS puede
    # traer un turno que la réplica del catálogo todavía no tenga, y una FK haría fallar
    # el sync entero en vez de degradar solo a esa persona.
    tu_codigo: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)
    activo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    sincronizado_en: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado",
        back_populates="turno_empleado",
        primaryjoin="cast(Empleado.no_empleado, String) == TurnoEmpleado.no_empleado",
        foreign_keys="TurnoEmpleado.no_empleado",
        viewonly=True,
    )
