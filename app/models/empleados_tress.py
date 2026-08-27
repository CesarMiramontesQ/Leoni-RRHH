from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class EmpleadoTress(Base):
    """Caché en Bono de los datos generales del colaborador que viven en TRESS.

    **No es una fuente editable**: la escribe únicamente
    ``app.services.sync_empleados_tress_service`` a partir de ``dbo.COLABORA``
    (DATOS_ANALISIS). Existe para que la Vista 360 no abra una conexión ODBC en cada
    apertura del detalle de un empleado.

    Guarda la fecha de ingreso (``CB_FEC_ING``) y el **contrato actual** (``CB_CONTRAT`` +
    ``CB_FEC_CON`` resueltos contra ``dbo.CONTRATO``), datos que Bono no tiene en ninguna
    parte: ``empleados`` es una tabla legada del esquema externo y no se le pueden agregar
    columnas.

    Del contrato se guarda una foto **desnormalizada** (código, descripción, días) y el
    vencimiento ya calculado (``fecha_contrato + contrato_dias``). ``fecha_vencimiento_contrato``
    NULL significa «no vence» cuando ``contrato_dias == 0`` (indefinido) y «sin dato» en los
    demás casos (sin catálogo o fecha vacía). El estatus vigente/por vencer/vencido **no** se
    guarda: depende de «hoy» y lo calcula ``contratos_service`` al leer.

    Dos decisiones deliberadas:

    - ``no_empleado`` es la llave primaria y es **Integer**, no ``String(50)`` como en
      :class:`app.models.turnos_empleados.TurnoEmpleado`. Aquella columna es texto por
      herencia de listados de Excel; aquí el único origen es ``dbo.COLABORA``, donde
      ``CB_CODIGO`` es numérico y hay a lo sumo una fila por colaborador.
    - **El sync nunca borra filas.** Se sincroniza toda ``dbo.COLABORA``, sin filtrar por
      ``CB_ACTIVO``: la Vista 360 se abre también sobre bajas, y una fecha de ingreso no
      deja de ser cierta cuando alguien se va.
    """

    __tablename__ = "levelup_empleados_tress"

    # Relación por no_empleado; sin FK declarativa (patrón Bono / levelup_emails).
    no_empleado: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    fecha_ingreso: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # Contrato actual (dbo.COLABORA.CB_CONTRAT → dbo.CONTRATO). Desnormalizado a propósito.
    contrato_codigo: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    contrato_descripcion: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # TB_DIAS: 0 = indefinido; NULL = código sin fila en el catálogo.
    contrato_dias: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fecha_contrato: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_vencimiento_contrato: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True, index=True
    )
    sincronizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado",
        primaryjoin="EmpleadoTress.no_empleado == Empleado.no_empleado",
        foreign_keys="EmpleadoTress.no_empleado",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"<EmpleadoTress no_empleado={self.no_empleado} "
            f"fecha_ingreso={self.fecha_ingreso}>"
        )
