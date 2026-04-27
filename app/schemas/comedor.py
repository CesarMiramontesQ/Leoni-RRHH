from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

ComedorTipoComidaLiteral = Literal["casera", "saludable"]


class ComedorResponse(BaseModel):
    id: int
    nombre: str
    ubicacion: Optional[str] = None
    capacidad: Optional[int] = None
    activo: bool

    model_config = {"from_attributes": True}


class ComedorCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=150)
    ubicacion: Optional[str] = Field(None, max_length=255)
    capacidad: Optional[int] = Field(None, ge=0, le=500_000)
    activo: bool = True


class MenuSemanalCreate(BaseModel):
    comedor_id: int
    semana: date
    dia: str
    tipo: str
    descripcion: Optional[str] = None


class MenuSemanalResponse(MenuSemanalCreate):
    id: int
    foto_path: Optional[str] = None
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ComedorRegistroCreate(BaseModel):
    comedor_id: int
    semana: date
    tipo_platillo: str


class ComedorRegistroResponse(ComedorRegistroCreate):
    id: int
    empleado_id: int
    acceso_concedido: bool
    huella_timestamp: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class HuellaValidarRequest(BaseModel):
    huella_id: str  # identificador único del lector / hash de huella
    comedor_id: int
    timestamp: datetime


class HuellaValidarResponse(BaseModel):
    acceso: bool
    empleado: Optional[str] = None
    tipo_platillo: Optional[str] = None


# --- Reserva diaria y terminal comedor ---


class ComedorAccesoReservaCreate(BaseModel):
    comedor_id: int
    fecha_servicio: date
    target_user_id: int | None = Field(
        default=None,
        description="Empleado beneficiario de la reserva (solo supervisor/gerente).",
    )
    tipo_comida: ComedorTipoComidaLiteral = Field(
        ...,
        description="Opción de comedor: casera o saludable",
    )


class ComedorAccesoReservaUpdate(BaseModel):
    tipo_comida: ComedorTipoComidaLiteral = Field(
        ...,
        description="Nuevo tipo de comida para el registro",
    )


class ComedorAccesoReservaResponse(BaseModel):
    id: int
    empleado_id: int
    comedor_id: int
    comedor_registro_id: int
    fecha_servicio: date
    tipo_comida: str
    estado_acceso: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ComedorMisReservaItem(BaseModel):
    id: int
    comedor_id: int
    fecha_servicio: date
    tipo_comida: str
    estado_acceso: str

    model_config = {"from_attributes": True}


class ComedorEquipoReservaItem(BaseModel):
    id: int
    empleado_id: int
    empleado_nombre: str
    empleado_nombre_corto: str
    fecha_servicio: date
    tipo_comida: str
    estado_acceso: str

    model_config = {"from_attributes": True}


class ComedorEquipoBeneficiarioItem(BaseModel):
    empleado_id: int
    no_empleado: str
    nombre: str
    nombre_corto: str


class ComedorPrimeraFechaReservaResponse(BaseModel):
    """Primera fecha (ISO) permitida para reservar comida (zona horaria de negocio)."""

    fecha_iso: date


class ComedorMisFechasOcupadasResponse(BaseModel):
    """Fechas (ISO) con reserva activa (PENDIENTE o ACCEDIDO) para el empleado en el rango."""

    fechas: list[date]


class ComedorTerminalAccederRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    comedor_id: int


class ComedorTerminalAccederResponse(BaseModel):
    permitido: bool
    acceso_id: Optional[int] = None
    empleado_nombre: Optional[str] = None
    tipo_platillo: Optional[str] = None
    motivo: Optional[
        Literal[
            "sin_reserva",
            "fuera_de_ventana",
            "credenciales_invalidas",
            "empleado_inactivo",
        ]
    ] = None


class ComedorTerminalConsumirRequest(BaseModel):
    acceso_id: int


class ComedorTerminalConsumirResponse(BaseModel):
    ok: bool
    hora_entrada: Optional[datetime] = None
