from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

ComedorTipoComidaLiteral = Literal["casera", "saludable"]


class MenuDiaDetalleSchema(BaseModel):
    sopa_o_crema: list[str] = Field(default_factory=list)
    guarniciones: list[str] = Field(default_factory=list)
    complementos: list[str] = Field(default_factory=list)
    tortillas: list[str] = Field(default_factory=list)
    postres: list[str] = Field(default_factory=list)
    salsas: list[str] = Field(default_factory=list)
    aguas: list[str] = Field(default_factory=list)


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


class ComedorUpdate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=150)
    ubicacion: Optional[str] = Field(None, max_length=255)
    capacidad: Optional[int] = Field(None, ge=0, le=500_000)
    activo: bool


class MenuSemanalCreate(BaseModel):
    comedor_id: int
    semana: date
    dia: str
    tipo: str
    descripcion: Optional[str] = None
    detalle: Optional[MenuDiaDetalleSchema] = None


class MenuSemanalResponse(MenuSemanalCreate):
    id: int
    foto_path: Optional[str] = None
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MenuSemanalDeleteResponse(BaseModel):
    comedor_id: int
    semana: date
    deleted_count: int


class MenuSemanalDiaDeleteResponse(BaseModel):
    """Resultado de vaciar el menú de un día (o de un solo tipo dentro del día)."""

    comedor_id: int
    semana: date
    dia: str
    tipo: Optional[str] = None
    deleted_count: int


class ComedorAsignadoResponse(BaseModel):
    """Comedor del empleado según `turnos_empleados` y catálogo `comedores`."""

    comedor_id: int
    comedor_nombre: str


class ComedorRegistroCreate(BaseModel):
    comedor_id: int | None = Field(
        default=None,
        description="Opcional; si se envía debe coincidir con el comedor asignado al empleado.",
    )
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
    comedor_id: int | None = Field(
        default=None,
        description="Opcional; si se envía debe coincidir con el comedor asignado al beneficiario.",
    )
    fecha_servicio: date | None = Field(
        default=None,
        description="Compatibilidad: fecha única de servicio.",
    )
    fechas_servicio: list[date] | None = Field(
        default=None,
        description="Fechas de servicio para reserva batch.",
    )
    target_user_id: int | None = Field(
        default=None,
        description="Empleado beneficiario de la reserva (solo supervisor/gerente).",
    )
    tipo_comida: ComedorTipoComidaLiteral = Field(
        ...,
        description="Opción de comedor: casera o saludable",
    )

    @model_validator(mode="after")
    def validate_fechas_payload(self) -> "ComedorAccesoReservaCreate":
        if self.fecha_servicio is None and not self.fechas_servicio:
            raise ValueError("Debes enviar fecha_servicio o fechas_servicio.")
        if self.fechas_servicio is not None and len(self.fechas_servicio) == 0:
            raise ValueError("fechas_servicio no puede ser un arreglo vacío.")
        return self


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


class ComedorRhRegistroCreate(BaseModel):
    person_type: Literal["interno", "externo"]
    comedor_id: int
    fechas_servicio: list[date] = Field(..., min_length=1)
    tipo_comida: ComedorTipoComidaLiteral
    target_user_id: int | None = None
    external_people_count: int | None = Field(default=None, ge=1, le=300)
    observaciones: str | None = None


class ComedorRhPaseExternoItem(BaseModel):
    """Un código/contraseña por comensal externo; usuario de terminal = codigo_acceso."""

    codigo_acceso: str
    password_temporal: str = Field(
        ...,
        description="PIN numérico aleatorio de 4 dígitos (0000-9999), único por pase dentro del mismo lote.",
    )


class ComedorRhCredencialTemporal(BaseModel):
    lote_id: str
    valido_desde: date
    valido_hasta: date
    pases: list[ComedorRhPaseExternoItem]


class ComedorRhRegistroResponse(BaseModel):
    total_registros_creados: int
    modo: Literal["interno", "externo"]
    credenciales_temporales: ComedorRhCredencialTemporal | None = None


class ComedorCodigoExternoItem(BaseModel):
    id: int
    comedor_id: int
    comedor_nombre: str
    fecha_inicio: date
    fecha_fin: date
    cantidad_personas: int
    tipo_comida: str
    codigo_acceso: str
    password_temporal: str
    estatus: Literal["ACTIVO", "USADO_PARCIAL", "USADO_TOTAL", "VENCIDO"]
    usados: int
    empleado_id: Optional[int] = None
    lote_id: Optional[str] = None


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


class ComedorResumenDiarioItem(BaseModel):
    fecha: date
    caseras: int
    saludables: int
    registros: int
    asistencias: int


class ComedorRhSemanaRegistrosFuturosItem(BaseModel):
    """Total de registros activos (PENDIENTE/ACCEDIDO) por semana ISO (fecha futura)."""

    semana_inicio: date
    total: int


class ComedorRhProximoRegistroItem(BaseModel):
    """Fila de acceso futuro (desde hoy) para supervisión RH."""

    id: int
    empleado_id: int
    empleado_nombre: str
    no_empleado: int
    area: str
    comedor_nombre: str
    fecha_servicio: date
    tipo_comida: str
    estado_acceso: str


class ComedorRhProximosRegistrosPage(BaseModel):
    items: list[ComedorRhProximoRegistroItem]
    total: int
    page: int
    page_size: int


class ComedorEquipoBeneficiarioItem(BaseModel):
    empleado_id: int
    no_empleado: int
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


class ComedorRhEmpleadoSinComedorItem(BaseModel):
    empleado_id: int
    no_empleado: int
    nombre: str


class ComedorRhEmpleadosSinComedorList(BaseModel):
    total: int
    items: list[ComedorRhEmpleadoSinComedorItem]


class ComedorRhEmpleadoBusquedaItem(BaseModel):
    """Empleado encontrado para registrar su consumo desde el modal de comedor."""

    empleado_id: int
    no_empleado: int
    nombre: str
    area: Optional[str] = None


class ComedorRhEmpleadosBusquedaList(BaseModel):
    total: int
    items: list[ComedorRhEmpleadoBusquedaItem]


class ComedorRhAsignacionComedorTurnoItem(BaseModel):
    empleado_id: int = Field(..., ge=1)
    comedor_id: int = Field(..., ge=1)


class ComedorRhAsignarComedorTurnosRequest(BaseModel):
    asignaciones: list[ComedorRhAsignacionComedorTurnoItem] = Field(..., min_length=1)


class ComedorRhAsignarComedorTurnosResponse(BaseModel):
    actualizados: int
