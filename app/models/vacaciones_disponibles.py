from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Integer, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class VacacionesDisponibles(Base):
    """Caché en Bono del saldo de vacaciones que vive en DATOS_ANALISIS (TRESS).

    **No es una fuente editable**: la escribe únicamente
    ``app.services.sync_vacaciones_disponibles_service`` a partir de
    ``dbo.GET_SALDOS_VACACION``. Existe para que dashboards, Vista 360 y el formulario de
    nueva solicitud no tengan que esperar a esa BD externa en cada carga de página.

    Guarda el ciclo (aniversario) vigente completo, no solo los días disponibles, para que
    las tarjetas «Disponibles» y «Utilizados» salgan del mismo cálculo y no se contradigan.
    """

    __tablename__ = "levelup_vacaciones_disponibles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Relación por no_empleado; sin FK declarativa (patrón Bono / levelup_emails).
    no_empleado: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    dias_disponibles: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    # Nulos cuando el empleado no tiene periodos registrados en TRESS.
    derecho_ciclo: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    tomados_ciclo: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    aniversario: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fecha_vence: Mapped[date | None] = mapped_column(Date, nullable=True)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado",
        primaryjoin="VacacionesDisponibles.no_empleado == Empleado.no_empleado",
        foreign_keys="VacacionesDisponibles.no_empleado",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"<VacacionesDisponibles no_empleado={self.no_empleado} "
            f"dias_disponibles={self.dias_disponibles}>"
        )
