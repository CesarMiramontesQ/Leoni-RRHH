from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, DateTime, Integer, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Turno(Base):
    """Réplica en Bono del catálogo de turnos de DATOS_ANALISIS (``[Datos].[dbo].[TURNO]``).

    **No es una fuente editable**: espeja 1:1 las 40 columnas del catálogo de TRESS para
    que la app no tenga que ir a esa BD externa cada vez que necesita la definición de un
    turno. La carga y la recarga se hacen desde el origen; nada en este proyecto escribe
    turnos propios aquí.

    Se conservan los nombres de columna de TRESS (``tu_*``) a propósito: la tabla es una
    réplica, no un modelo de dominio, y renombrar dificultaría cotejarla contra el origen.

    No confundir con :class:`app.models.turnos_empleados.TurnoEmpleado`
    (``levelup_turnos_empleados``), que asigna turno/comedor a cada empleado. Esta tabla
    es el catálogo; aquella es la asignación.

    Notas de fidelidad frente al origen (SQL Server):

    - ``tu_codigo`` es ``char(6)`` igual que en TRESS y viene con relleno de espacios
      (``'01    '``). Tanto SQL Server como PostgreSQL tratan los espacios finales de
      ``char(n)`` como no significativos; aun así, el código que compare códigos debe
      normalizar con ``RTRIM`` como ya hace el resto de la integración.
    - ``tu_rit_pat`` es el patrón rotativo y **contiene CRLF** en buena parte de las
      filas. Se replica tal cual, sin recortar.
    - ``tu_rit_ini`` corresponde a un ``datetime`` de SQL Server; el valor "vacío" de
      TRESS es ``1899-12-30``, no ``NULL``. Todas las columnas del origen son NOT NULL.
    """

    __tablename__ = "levelup_turnos"

    tu_codigo: Mapped[str] = mapped_column(CHAR(6), primary_key=True)
    tu_descrip: Mapped[str] = mapped_column(String(100), nullable=False)
    tu_dias: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_dobles: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    tu_domingo: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    tu_festivo: Mapped[str] = mapped_column(CHAR(1), nullable=False)
    # Horario aplicable a cada día de la semana; referencia dbo.HORARIO en el origen.
    tu_hor_1: Mapped[str] = mapped_column(CHAR(6), nullable=False)
    tu_hor_2: Mapped[str] = mapped_column(CHAR(6), nullable=False)
    tu_hor_3: Mapped[str] = mapped_column(CHAR(6), nullable=False)
    tu_hor_4: Mapped[str] = mapped_column(CHAR(6), nullable=False)
    tu_hor_5: Mapped[str] = mapped_column(CHAR(6), nullable=False)
    tu_hor_6: Mapped[str] = mapped_column(CHAR(6), nullable=False)
    tu_hor_7: Mapped[str] = mapped_column(CHAR(6), nullable=False)
    tu_horario: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_jornada: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    tu_nomina: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_rit_ini: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    tu_rit_pat: Mapped[str] = mapped_column(String(4096), nullable=False)
    # Tipo de día (0 = laborable, 2 = descanso, …) para cada día de la semana.
    tu_tip_1: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_tip_2: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_tip_3: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_tip_4: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_tip_5: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_tip_6: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_tip_7: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_tip_jor: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    tu_ingles: Mapped[str] = mapped_column(String(100), nullable=False)
    tu_texto: Mapped[str] = mapped_column(String(100), nullable=False)
    tu_numero: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    tu_hor_fes: Mapped[str] = mapped_column(CHAR(6), nullable=False)
    tu_vaca_ha: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    tu_vaca_sa: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    tu_vaca_de: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    tu_sub_cta: Mapped[str] = mapped_column(String(100), nullable=False)
    tu_dias_ba: Mapped[Decimal] = mapped_column(Numeric(15, 5), nullable=False)
    tu_activo: Mapped[str] = mapped_column(CHAR(1), nullable=False)
    tu_tip_jt: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    # Identificador interno de TRESS. Se replica, pero la llave del catálogo es tu_codigo.
    llave: Mapped[int] = mapped_column(Integer, nullable=False)
    tu_nivel0: Mapped[str] = mapped_column(String(255), nullable=False)
    tu_sat_jor: Mapped[str] = mapped_column(CHAR(6), nullable=False)

    def __repr__(self) -> str:
        return f"<Turno tu_codigo={self.tu_codigo!r} tu_descrip={self.tu_descrip!r}>"
