"""Schemas del dashboard de seguimiento de cursos."""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

EstadoCursoEmpleadoLiteral = Literal[
    "pendiente", "programado", "completado", "no_acreditado", "en_progreso"
]


class CursosDashboardKpis(BaseModel):
    cursos_asignados: int = 0
    cursos_pendientes: int = 0
    cursos_completados: int = 0
    cursos_con_sesion_proxima: int = 0
    sesiones_pendientes: int = 0
    sesiones_programadas: int = 0
    sesiones_completadas: int = 0
    empleados_con_cursos_pendientes: int = 0
    empleados_con_sesiones_pendientes: int = 0
    empleados_sin_completar_obligatorio: int = 0


class CursosDashboardEmpleadoResumenItem(BaseModel):
    empleado_id: int
    nombre_empleado: str | None = None
    no_empleado: str | None = None
    area_nombre: str | None = None
    pendientes_count: int = 0


class CursosDashboardSesionProximaItem(BaseModel):
    sesion_id: int
    curso_id: int
    curso_nombre: str | None = None
    fecha_inicio: str
    estado: str
    inscritos_count: int = 0


class CursosDashboardCursoCompletadoItem(BaseModel):
    empleado_id: int
    nombre_empleado: str | None = None
    curso_id: int
    curso_nombre: str | None = None
    fecha_finalizacion: str | None = None


class CursosDashboardAreaItem(BaseModel):
    """Opcion del selector de area de la pantalla de seguimiento. Se calcula
    sin el filtro aplicado, para que elegir un area no vacie la lista."""

    id: int
    nombre: str


class CursosDashboardResumenResponse(BaseModel):
    kpis: CursosDashboardKpis
    areas: list[CursosDashboardAreaItem] = Field(default_factory=list)
    empleados_cursos_pendientes: list[CursosDashboardEmpleadoResumenItem] = Field(default_factory=list)
    empleados_sesiones_pendientes: list[CursosDashboardEmpleadoResumenItem] = Field(default_factory=list)
    sesiones_proximas: list[CursosDashboardSesionProximaItem] = Field(default_factory=list)
    cursos_completados_recientes: list[CursosDashboardCursoCompletadoItem] = Field(default_factory=list)


class CursosDashboardRegistroItem(BaseModel):
    empleado_id: int
    nombre_empleado: str | None = None
    no_empleado: str | None = None
    area_nombre: str | None = None
    puesto_nombre: str | None = None
    curso_id: int
    curso_nombre: str | None = None
    curso_obligatorio: bool = False
    estado_curso: EstadoCursoEmpleadoLiteral
    origen_asignacion: str | None = None
    sesion_id: int | None = None
    sesion_fecha_inicio: str | None = None
    estado_sesion: str | None = None
    asistio: bool | None = None
    fecha_finalizacion: str | None = None


class CursosDashboardRegistrosResponse(BaseModel):
    items: list[CursosDashboardRegistroItem]
    total: int
    page: int
    page_size: int


class CursosDashboardHistorialCursoItem(BaseModel):
    curso_id: int
    curso_nombre: str | None = None
    curso_obligatorio: bool = False
    estado_curso: EstadoCursoEmpleadoLiteral
    origen_asignacion: str | None = None
    fecha_finalizacion: str | None = None


class CursosDashboardHistorialSesionItem(BaseModel):
    sesion_id: int
    curso_id: int
    curso_nombre: str | None = None
    fecha_inicio: str
    fecha_fin: str | None = None
    estado_sesion: str
    asistio: bool | None = None
    es_proxima: bool = False


class CursosDashboardEmpleadoHistorialResponse(BaseModel):
    empleado_id: int
    nombre_empleado: str | None = None
    no_empleado: str | None = None
    area_nombre: str | None = None
    puesto_nombre: str | None = None
    cursos: list[CursosDashboardHistorialCursoItem] = Field(default_factory=list)
    sesiones: list[CursosDashboardHistorialSesionItem] = Field(default_factory=list)
