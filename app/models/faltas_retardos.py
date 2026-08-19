from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado

FALTA_RETARDO_TIPOS = (
    "falta_justificada",
    "falta_injustificada",
    "retardo",
    "incapacidad",
    "suspension",
    "matrimonio",
    "incapacidad_interna",
    "defuncion",
    "paternidad",
    # Llega solo por el sync desde dbo.AUSENCIA (AU_TIPO VAC); no se captura a mano.
    "vacaciones",
)

# Tipos con goce de sueldo: registro directo RH en levelup (sin Bono).
FALTA_RETARDO_TIPOS_GOCE = frozenset(
    {"matrimonio", "incapacidad_interna", "defuncion", "paternidad"}
)

# Tipos que rankean el "Top de empleados con mas eventos". Fuera quedan las vacaciones
# —que son la mayoria de los eventos y taparian el resto— y los permisos con goce, que
# son un derecho y no una incidencia del colaborador. Es el mismo criterio que
# `FALTA_RETARDO_TIPOS_DASHBOARD_EQUIPO` en
# `frontend/src/faltasRetardos/rh/constants.ts`, y por la misma razon se deriva del
# catalogo: un tipo nuevo entra solo en vez de quedar olvidado en una lista.
FALTA_RETARDO_TIPOS_TOP_EMPLEADOS = tuple(
    tipo
    for tipo in FALTA_RETARDO_TIPOS
    if tipo != "vacaciones" and tipo not in FALTA_RETARDO_TIPOS_GOCE
)

# Los pone nomina, no la app: FI y RE los calcula TRESS desde las checadas, y las
# vacaciones llegan de la solicitud aprobada. Entran por el sync de dbo.AUSENCIA, nunca
# por el alta de RH; el modal tampoco los ofrece
# (frontend/src/faltasRetardos/rh/constants.ts).
FALTA_RETARDO_TIPOS_CALCULADOS_TRESS = frozenset(
    {"falta_injustificada", "retardo", "vacaciones"}
)

FALTA_RETARDO_TIPOS_RANGO = frozenset(
    {
        "incapacidad",
        "suspension",
        "matrimonio",
        "incapacidad_interna",
        "defuncion",
        "paternidad",
    }
)


class FaltaRetardoEvento(Base):
    __tablename__ = "levelup_faltas_retardos"
    __table_args__ = (
        CheckConstraint(
            "fecha_fin IS NULL OR fecha_fin >= fecha_evento",
            name="chk_faltas_retardos_fecha_fin_gte_inicio",
        ),
        Index("ix_levelup_faltas_retardos_empleado_id", "empleado_id"),
        Index("ix_levelup_faltas_retardos_tipo", "tipo"),
        Index("ix_levelup_faltas_retardos_fecha_evento", "fecha_evento"),
        Index("ix_levelup_faltas_retardos_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    tipo: Mapped[str] = mapped_column(
        Enum(*FALTA_RETARDO_TIPOS, name="falta_retardo_tipo_enum"),
        nullable=False,
    )
    fecha_evento: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    registrado_por_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])
    registrado_por: Mapped["Empleado"] = relationship(
        "Empleado", foreign_keys=[registrado_por_id]
    )

    def __repr__(self) -> str:
        return f"<FaltaRetardoEvento id={self.id} tipo={self.tipo} empleado_id={self.empleado_id}>"


class FaltaRetardoRegistroAuditoria(Base):
    """Quién registró en RH un evento insertado en bono (importadas_historico)."""

    __tablename__ = "levelup_faltas_retardos_registro"
    __table_args__ = (
        UniqueConstraint(
            "bono_origen",
            "bono_origen_id",
            name="uq_levelup_faltas_retardos_registro_bono",
        ),
        Index("ix_levelup_faltas_retardos_registro_bono_origen_id", "bono_origen_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bono_origen: Mapped[str] = mapped_column(String(64), nullable=False)
    bono_origen_id: Mapped[int] = mapped_column(Integer, nullable=False)
    registrado_por_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    registrado_por: Mapped["Empleado"] = relationship(
        "Empleado", foreign_keys=[registrado_por_id]
    )

    def __repr__(self) -> str:
        return (
            f"<FaltaRetardoRegistroAuditoria bono={self.bono_origen}:{self.bono_origen_id} "
            f"por={self.registrado_por_id}>"
        )
