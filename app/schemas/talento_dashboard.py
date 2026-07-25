# app/schemas/talento_dashboard.py
"""
Schemas Pydantic v2 del Dashboard de Talento (agregador de solo lectura).

Separados de `app/schemas/talento.py`, que cubre otro dominio (Puestos Perfil y
Competencias): comparten el nombre "talento" pero no un solo tipo.

Sincronizados con `frontend/src/api/talento.ts`. Cada bloque comparte la misma
forma -- `disponible` + `org` + `areas[]` -- para que el frontend los trate de
forma uniforme y pueda pintar cada columna en cuanto llega.
"""

from datetime import date

from pydantic import BaseModel, ConfigDict

_CFG = ConfigDict(from_attributes=True)


class CicloInfoSchema(BaseModel):
    model_config = _CFG

    id: int
    nombre: str
    estado: str


class AreaDesempenoSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    n_empleados: int
    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float | None
    distribucion: dict[str, int]
    semaforo: str | None


class OrgDesempenoSchema(BaseModel):
    model_config = _CFG

    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float | None
    distribucion: dict[str, int]
    nine_box: dict[str, int]
    semaforo: str | None
    n_empleados: int


class BloqueDesempenoResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    ciclo: CicloInfoSchema | None = None
    org: OrgDesempenoSchema | None = None
    areas: list[AreaDesempenoSchema] = []


class AreaPolivalenciaSchema(BaseModel):
    model_config = _CFG

    area_id: int
    area_nombre: str
    n_empleados: int
    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    semaforo: str | None


class OrgPolivalenciaSchema(BaseModel):
    model_config = _CFG

    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    n_empleados: int
    semaforo: str | None


class BloquePolivalenciaResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    org: OrgPolivalenciaSchema | None = None
    areas: list[AreaPolivalenciaSchema] = []


class AreaCapacitacionSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    total_pares: int
    completados: int
    cumplimiento_pct: float | None
    n_obligatorio_pendiente: int
    semaforo: str | None


class OrgCapacitacionSchema(BaseModel):
    model_config = _CFG

    total_pares: int
    completados: int
    cumplimiento_pct: float | None
    n_obligatorio_pendiente: int
    semaforo: str | None


class BloqueCapacitacionResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    org: OrgCapacitacionSchema | None = None
    areas: list[AreaCapacitacionSchema] = []


class AreaPdiSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    total: int
    completados: int
    cancelados: int
    cumplimiento_pct: float | None
    n_vencidos: int
    n_activos: int
    semaforo: str | None


class OrgPdiSchema(BaseModel):
    model_config = _CFG

    total: int
    completados: int
    cancelados: int
    cumplimiento_pct: float | None
    n_vencidos: int
    n_activos: int
    semaforo: str | None


class BloquePdiResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    org: OrgPdiSchema | None = None
    areas: list[AreaPdiSchema] = []


class RangoObjetivoSchema(BaseModel):
    model_config = _CFG

    desde: date
    hasta: date


class AreaObjetivoSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    n_empleados: int
    indice_promedio: float | None


class OrgObjetivoSchema(BaseModel):
    model_config = _CFG

    n_empleados: int
    indice_promedio: float | None


class BloqueObjetivoResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    rango: RangoObjetivoSchema | None = None
    org: OrgObjetivoSchema | None = None
    areas: list[AreaObjetivoSchema] = []


class EmpleadoFocoSchema(BaseModel):
    model_config = _CFG

    empleado_id: int
    no_empleado: int | str | None
    nombre: str
    puesto_nombre: str | None
    senales: list[str]


class DetalleAreaResponse(BaseModel):
    model_config = _CFG

    area_id: int
    area_nombre: str
    desempeno: AreaDesempenoSchema | None
    polivalencia: AreaPolivalenciaSchema | None
    capacitacion: AreaCapacitacionSchema | None
    pdi: AreaPdiSchema | None
    empleados_foco: list[EmpleadoFocoSchema] = []
