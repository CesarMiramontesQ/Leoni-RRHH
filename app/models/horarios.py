from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Horario(Base):
    """Caché en Bono del catálogo de jornadas ``[Datos].[dbo].[HORARIO]`` de TRESS.

    Es la contraparte de :class:`app.models.turnos.Turno`: mientras el turno dice *qué
    jornada toca cada día* (fija por día de semana, o rotativa vía ``TU_RIT_PAT``), este
    catálogo dice *a qué hora entra y sale* esa jornada. Ajustes Comedor la necesita para
    nombrar los segmentos del ciclo ("Nocturno 22:00-06:00") y para colgar de ella la
    ventana de comida, sin ir a TRESS en cada carga de página.

    **No es una fuente editable**: la escribe únicamente
    ``app.services.sync_turnos_catalogo_service``.

    Dos decisiones deliberadas, distintas a las de ``levelup_turnos``:

    - ``ho_codigo`` se guarda **ya normalizado** (sin el relleno de ``CHAR(6)``), igual
      que :class:`app.models.turnos_uso.TurnoUso`. Los códigos con los que se consulta
      esta tabla vienen de dos lados que ya llegan sin padding: ``RTRIM(TU_HOR_n)`` y los
      tokens ``N:CODIGO`` del patrón rotativo. Guardar padding obligaría a un ``rtrim()``
      en cada join y a recordar rellenarlo al insertar.
    - Se replica **solo el subconjunto que el proyecto lee**, no las 32 columnas del
      origen: el resto (tolerancias de retardo, banderas de checada de comida, cuentas
      contables) pertenece al cálculo de nómina, que este sistema no hace.

    ``ho_intime`` / ``ho_outtime`` son strings de 4 dígitos tipo ``'0600'`` / ``'2200'``,
    tal como los guarda TRESS; se convierten con
    ``app.utils.turno_calendario.parse_hora_tress``. Una jornada
    puede cruzar medianoche (``'2200'`` → ``'0600'``), así que la salida **no** es
    necesariamente mayor que la entrada.
    """

    __tablename__ = "levelup_horarios"

    ho_codigo: Mapped[str] = mapped_column(String(6), primary_key=True)
    ho_descrip: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    ho_intime: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    ho_outtime: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    ho_jornada: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    ho_activo: Mapped[str] = mapped_column(String(1), nullable=False, default="S")
    sincronizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return (
            f"<Horario ho_codigo={self.ho_codigo!r} "
            f"{self.ho_intime}-{self.ho_outtime}>"
        )
