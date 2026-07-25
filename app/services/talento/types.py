"""Estructuras puras de la agregacion del Dashboard de Talento (sin Pydantic ni DB).

Incluye tanto las senales por empleado como las dataclasses de salida que
arma `TalentoService` (un bloque por area/org). Ninguna de estas clases toca
`self` ni la BD: son contenedores de datos ya calculados. Viven aca (y no en
el service) para mantener `talento_service.py` enfocado en la logica de
agregacion; `talento_service.py` las reexporta para no romper a quien ya las
importa desde ahi.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

# Nombres canonicos de las senales de riesgo. El orden define el orden de los
# badges en la UI.
SENALES = ("desempeno_bajo", "polivalencia_baja", "capacitacion_pendiente", "pdi_vencido")


@dataclass
class SenalesEmpleado:
    """Senales de riesgo de un empleado dentro de un area.

    Cada senal es `True` (mala), `False` (bien) o `None` (no evaluable: no hay
    ciclo, el empleado no tiene competencias requeridas, etc.). `None` NUNCA
    cuenta como senal mala -- la ausencia de dato no es riesgo.
    """

    empleado_id: int
    no_empleado: int | str | None
    nombre: str
    puesto_nombre: str | None = None
    desempeno_bajo: bool | None = None
    polivalencia_baja: bool | None = None
    capacitacion_pendiente: bool | None = None
    pdi_vencido: bool | None = None

    @property
    def senales_activas(self) -> list[str]:
        return [s for s in SENALES if getattr(self, s) is True]

    @property
    def n_senales(self) -> int:
        return len(self.senales_activas)


# ── Tipos de salida de TalentoService ───────────────────────────────────────
@dataclass
class OrgPolivalencia:
    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    n_empleados: int
    semaforo: str | None


@dataclass
class AreaPolivalencia:
    area_id: int
    area_nombre: str
    n_empleados: int
    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    semaforo: str | None


@dataclass
class BloquePolivalencia:
    disponible: bool
    org: OrgPolivalencia | None
    areas: list[AreaPolivalencia] = field(default_factory=list)
    motivo: str | None = None


@dataclass
class AreaDesempeno:
    area_id: int | None
    area_nombre: str
    n_empleados: int
    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float
    distribucion: dict[str, int]
    semaforo: str | None


@dataclass
class OrgDesempeno:
    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float
    distribucion: dict[str, int]
    nine_box: dict[str, int]
    semaforo: str | None
    n_empleados: int


@dataclass
class CicloInfo:
    id: int
    nombre: str
    estado: str


@dataclass
class BloqueDesempeno:
    disponible: bool
    ciclo: CicloInfo | None = None
    org: OrgDesempeno | None = None
    areas: list[AreaDesempeno] = field(default_factory=list)
    motivo: str | None = None


@dataclass
class AreaCapacitacion:
    area_id: int | None
    area_nombre: str
    total_pares: int
    completados: int
    cumplimiento_pct: float | None
    n_obligatorio_pendiente: int
    semaforo: str | None


@dataclass
class OrgCapacitacion:
    total_pares: int
    completados: int
    cumplimiento_pct: float | None
    n_obligatorio_pendiente: int
    semaforo: str | None


@dataclass
class BloqueCapacitacion:
    disponible: bool
    org: OrgCapacitacion | None = None
    areas: list[AreaCapacitacion] = field(default_factory=list)
    motivo: str | None = None


@dataclass
class AreaPdi:
    """`total` incluye TODAS las filas (tambien las canceladas).

    `cumplimiento_pct` y `n_activos` excluyen los PDI cancelados: un PDI
    cancelado no cuenta como activo ni castiga el cumplimiento. `cancelados`
    expone el conteo excluido para que quien consuma el dato pueda reconciliar
    `total` con el denominador efectivo (`total - cancelados`) usado en el pct.
    """

    area_id: int | None
    area_nombre: str
    total: int
    completados: int
    cancelados: int
    cumplimiento_pct: float | None
    n_vencidos: int
    n_activos: int
    semaforo: str | None


@dataclass
class OrgPdi:
    """Mismo criterio que `AreaPdi`: cancelados excluidos de pct y activos."""

    total: int
    completados: int
    cancelados: int
    cumplimiento_pct: float | None
    n_vencidos: int
    n_activos: int
    semaforo: str | None


@dataclass
class BloquePdi:
    disponible: bool
    org: OrgPdi | None = None
    areas: list[AreaPdi] = field(default_factory=list)
    motivo: str | None = None


@dataclass
class AreaObjetivo:
    area_id: int | None
    area_nombre: str
    n_empleados: int
    indice_promedio: float | None


@dataclass
class OrgObjetivo:
    n_empleados: int
    indice_promedio: float | None


@dataclass
class RangoObjetivo:
    desde: date
    hasta: date


@dataclass
class EmpleadoFoco:
    empleado_id: int
    no_empleado: int | str | None
    nombre: str
    puesto_nombre: str | None
    senales: list[str]


@dataclass
class BloqueObjetivo:
    disponible: bool
    rango: RangoObjetivo | None = None
    org: OrgObjetivo | None = None
    areas: list[AreaObjetivo] = field(default_factory=list)
    motivo: str | None = None


@dataclass
class DetalleArea:
    area_id: int
    area_nombre: str
    desempeno: AreaDesempeno | None
    polivalencia: AreaPolivalencia | None
    capacitacion: AreaCapacitacion | None
    pdi: AreaPdi | None
    empleados_foco: list[EmpleadoFoco] = field(default_factory=list)
