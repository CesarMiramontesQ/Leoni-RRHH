# app/schemas/solicitudes.py
"""
Schemas Pydantic v2 para el dominio solicitudes.

Convencion:
  - {Entidad}Create  — entrada para POST
  - {Entidad}Update  — entrada para PATCH (todos Optional)
  - {Entidad}Response — salida; siempre model_config = {"from_attributes": True}
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


SOLICITUD_TIPOS_VALIDOS = {
    "vacaciones",
    "home_office",
    "matrimonio",
    "incapacidad_interna",
    "defuncion",
    "paternidad",
    "permiso_sin_goce_sueldo",
}
SOLICITUD_ESTADOS_VALIDOS = {
    "pending",
    "approved",
    "rejected",
    "cancelled",
    "overridden",
    "changes_requested",
}
APROBACION_ACCIONES_VALIDAS = {"approve", "reject", "override", "request_changes"}

# Valor persistido en `solicitudes.estado` cuando la solicitud queda aprobada (enum del sistema).
# La UI puede mostrar «aprobado»; en base de datos el canonico es `approved`.
ESTADO_SOLICITUD_APROBADA = "approved"


class SolicitudCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    tipo: str
    fecha_inicio: date
    fecha_fin: date
    motivo: Optional[str] = None
    comentarios: Optional[str] = None
    empleado_id: Optional[int] = Field(
        default=None,
        description=(
            "ID del colaborador titular de la solicitud. Omitir o usar el propio ID equivale a solicitar "
            "para uno mismo. Roles supervisor/gerente/rh/director pueden indicar un colaborador autorizado."
        ),
    )

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v: str) -> str:
        if v not in SOLICITUD_TIPOS_VALIDOS:
            raise ValueError(f"tipo debe ser uno de: {sorted(SOLICITUD_TIPOS_VALIDOS)}")
        return v

    @field_validator("fecha_fin")
    @classmethod
    def validar_fechas(cls, v: date, info) -> date:
        fecha_inicio = info.data.get("fecha_inicio")
        if fecha_inicio and v < fecha_inicio:
            raise ValueError("fecha_fin debe ser mayor o igual a fecha_inicio")
        return v

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, v: Optional[str], info) -> Optional[str]:
        tipo = info.data.get("tipo")
        txt = (v or "").strip()
        if tipo == "permiso_sin_goce_sueldo" and not txt:
            raise ValueError("motivo es obligatorio para permiso sin goce de sueldo")
        return txt or None


class SolicitudUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    estado: Optional[str] = None
    comentarios: Optional[str] = None
    nivel_actual: Optional[int] = None

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in SOLICITUD_ESTADOS_VALIDOS:
            raise ValueError(f"estado debe ser uno de: {sorted(SOLICITUD_ESTADOS_VALIDOS)}")
        return v


class SolicitudResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    tipo: str
    fecha_inicio: date
    fecha_fin: date
    estado: str
    nivel_actual: int
    motivo: Optional[str]
    comentarios: Optional[str]
    created_at: datetime
    # Enriquecimiento para listados y UI (no son columnas de `solicitudes`).
    empleado_nombre: str = ""
    empleado_no_empleado: Optional[int] = None
    empleado_area: Optional[str] = None
    empleado_puesto: Optional[str] = None
    empleado_foto: Optional[str] = None
    lider_id: Optional[int] = None
    lider_nombre: Optional[str] = None
    # Flujo jerarquico (enriquecido principalmente en GET por id).
    gerente_linea_id: Optional[int] = None
    gerente_linea_nombre: Optional[str] = None
    supervisor_aprobo: bool = False
    pendiente_aprobacion_supervisor: bool = False
    pendiente_aprobacion_gerente: bool = False


class SolicitudSolicitarCambiosBody(BaseModel):
    """Entrada para PUT request-changes (aprobador)."""

    model_config = {"str_strip_whitespace": True}

    nivel: int = 1
    comentario: str

    @field_validator("comentario")
    @classmethod
    def comentario_no_vacio(cls, v: str) -> str:
        t = (v or "").strip()
        if not t:
            raise ValueError("comentario es obligatorio para solicitar cambios")
        return t


class SolicitudRequisitorRevision(BaseModel):
    """
    Body para reenviar una solicitud tras `changes_requested` (solo el dueño).

    Solo fechas y motivo: `tipo` y `empleado_id` no forman parte del contrato y no deben
    alterarse en el servicio (el UPDATE persistido no los modifica).
    """

    model_config = {"str_strip_whitespace": True}

    fecha_inicio: date
    fecha_fin: date
    motivo: Optional[str] = None

    @field_validator("fecha_fin")
    @classmethod
    def validar_fechas(cls, v: date, info) -> date:
        fecha_inicio = info.data.get("fecha_inicio")
        if fecha_inicio and v < fecha_inicio:
            raise ValueError("fecha_fin debe ser mayor o igual a fecha_inicio")
        return v


class SolicitudAprobacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    accion: str
    nivel: int
    comentario: Optional[str] = None

    @field_validator("accion")
    @classmethod
    def validar_accion(cls, v: str) -> str:
        if v not in APROBACION_ACCIONES_VALIDAS:
            raise ValueError(f"accion debe ser una de: {sorted(APROBACION_ACCIONES_VALIDAS)}")
        return v


class SolicitudAprobacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    solicitud_id: int
    aprobador_id: int
    accion: str
    nivel: int
    comentario: Optional[str]
    timestamp: datetime
    # Enriquecido en el servicio (no es columna de `solicitud_aprobaciones`).
    aprobador_nombre: str = ""


class HomeOfficeDisponibilidadResponse(BaseModel):
    empleado_id: int
    anio: int
    mes: int
    dias_usados: int = Field(..., ge=0)
    puede_solicitar: bool
