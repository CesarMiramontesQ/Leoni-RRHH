from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class HomeOfficeTomados(Base):
    """Caché en Bono de los días de home office que viven en DATOS_ANALISIS (TRESS).

    **No es una fuente editable**: la escribe únicamente
    ``app.services.sync_homeoffice_tomados_service`` a partir de ``dbo.PERMISO``
    (``PM_TIPO = 'HO'``). Existe para que el dashboard no tenga que esperar a esa BD
    externa en cada carga de página.

    Una fila por empleado y año calendario, que es el periodo con el que el negocio cuenta
    el home office. Las filas de años anteriores se conservan: el sync solo reescribe el
    año en curso.
    """

    __tablename__ = "levelup_homeoffice_tomados"
    __table_args__ = (
        UniqueConstraint(
            "no_empleado", "anio", name="uq_levelup_homeoffice_tomados_empleado_anio"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Relación por no_empleado; sin FK declarativa (patrón Bono / levelup_emails).
    no_empleado: Mapped[int] = mapped_column(Integer, nullable=False)
    anio: Mapped[int] = mapped_column(Integer, nullable=False)
    dias_tomados: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=0
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado",
        primaryjoin="HomeOfficeTomados.no_empleado == Empleado.no_empleado",
        foreign_keys="HomeOfficeTomados.no_empleado",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"<HomeOfficeTomados no_empleado={self.no_empleado} anio={self.anio} "
            f"dias_tomados={self.dias_tomados}>"
        )
