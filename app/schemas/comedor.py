from datetime import date, datetime, time
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
    comedor_id: Optional[int] = None


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


# --- Ajustes Comedor: ventana de comida por jornada ---


class ComedorJornadaComidaItem(BaseModel):
    """Jornada de TRESS (`levelup_horarios`) con su ventana de comida, si ya tiene una.

    Es la única superficie editable de Ajustes Comedor: la hora de comer depende de la
    jornada que toca ese día, no del turno, porque un turno rotativo recorre varias.

    `turnos` y `empleados_activos` existen para que quien edita vea el alcance real del
    cambio: la jornada `001` la comparten 8 turnos y más de 500 personas.
    """

    ho_codigo: str
    descripcion: str
    # De `HO_INTIME` / `HO_OUTTIME`. La salida puede ser menor que la entrada: hay
    # jornadas que cruzan medianoche (18:00-06:00).
    hora_entrada: Optional[time] = None
    hora_salida: Optional[time] = None
    jornada_horas: Optional[float] = None
    activo: bool = True
    hora_inicio_comida: Optional[time] = None
    hora_fin_comida: Optional[time] = None
    actualizado_en: Optional[datetime] = None
    turnos: list[str] = []
    # Personal de los turnos que usan esta jornada, según `levelup_turnos_uso`. `None` =
    # la caché nunca se ha sincronizado, que no es lo mismo que 0 empleados.
    empleados_activos: Optional[int] = None
    # `False` = algún turno la referencia pero no está en el catálogo replicado.
    en_catalogo: bool = True


class ComedorJornadaComidaUpsert(BaseModel):
    hora_inicio_comida: time
    hora_fin_comida: time

    @model_validator(mode="after")
    def validar_rango(self) -> "ComedorJornadaComidaUpsert":
        # A diferencia de la configuración por turno que esto sustituye, NO se exige
        # inicio < fin: la jornada de 18:00-06:00 come alrededor de las 23:30-00:30, y
        # rechazarlo dejaría al turno de noche sin poder configurarse. Cuando el fin es
        # menor o igual que el inicio, la ventana cruza a la medianoche.
        if self.hora_inicio_comida == self.hora_fin_comida:
            raise ValueError("La hora de inicio y la de fin no pueden ser iguales.")
        return self


class ComedorTurnoCicloBloque(BaseModel):
    """Tramo de días consecutivos del ciclo que comparten jornada y ventana de comida."""

    dia_inicio: int
    dia_fin: int
    dias: int
    # "Días 1–2" en un rotativo, "Lun–Vie" en un fijo.
    etiqueta: str
    estatus: Literal["LABORABLE", "DESCANSO"]
    ho_codigo: Optional[str] = None
    ho_descripcion: Optional[str] = None
    hora_entrada: Optional[time] = None
    hora_salida: Optional[time] = None
    hora_inicio_comida: Optional[time] = None
    hora_fin_comida: Optional[time] = None
    configurada: bool = False


class ComedorTurnoComidaItem(BaseModel):
    """Turno del catálogo con su ciclo desglosado en bloques.

    `jornada_horas` y `dias_semana` vienen del catálogo de TRESS (`tu_jornada`, `tu_dias`)
    y se exponen como contexto. Son de solo lectura; este sistema nunca los escribe.
    """

    tu_codigo: str
    descripcion: str
    activo: bool
    tipo_turno: Literal["FIJO", "ROTATIVO"]
    jornada_horas: Optional[float] = None
    dias_semana: Optional[int] = None
    empleados_activos: Optional[int] = None
    longitud_ciclo: Optional[int] = None
    jornadas: list[str] = []
    jornadas_configuradas: int = 0
    bloques: list[ComedorTurnoCicloBloque] = []
    # Texto para degradar la fila cuando el ciclo no se puede calcular.
    aviso: Optional[str] = None


class ComedorVentanaComidaResponse(BaseModel):
    """Resultado de «qué comida le toca a esta persona en esta fecha»."""

    no_empleado: str
    nombre: Optional[str] = None
    fecha: date
    tu_codigo: Optional[str] = None
    turno_descripcion: Optional[str] = None
    tipo_turno: Optional[Literal["FIJO", "ROTATIVO"]] = None
    estatus: Optional[Literal["LABORABLE", "DESCANSO"]] = None
    posicion_ciclo: Optional[int] = None
    longitud_ciclo: Optional[int] = None
    ho_codigo: Optional[str] = None
    ho_descripcion: Optional[str] = None
    hora_entrada: Optional[time] = None
    hora_salida: Optional[time] = None
    hora_inicio_comida: Optional[time] = None
    hora_fin_comida: Optional[time] = None
    motivo_sin_ventana: Optional[str] = None
    aviso: Optional[str] = None
    # Fecha del último sync empleado→turno. El turno es una foto de hoy, no un histórico:
    # consultar una fecha pasada de alguien que cambió de rotación devuelve el turno
    # actual, y quien lee el resultado necesita saberlo.
    turno_sincronizado_en: Optional[datetime] = None
