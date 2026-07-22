# app/api/v1/historial_objetivo/router.py
"""
Router del modulo Historial Objetivo (indice 0-100 + semaforo por empleado,
combinando actas, faltas/retardos e incidencias).

Convenciones (mismo patron que `app/api/v1/faltas_retardos/router.py` y las
estadisticas de `app/api/v1/incidencias`): gestion (`GET /empleados/{id}`,
`GET /equipo`, `GET /equipo/export`) exige
`role_checker(["operativo", "gerente", "supervisor", "director"])` -- permite
RH con el modulo 'historial-objetivo' (via `resolve_module_from_api_path` +
`user_has_module`, resuelto dentro de `role_checker`), y supervisor/gerente/
director nativos (o admin en el modo UI correspondiente).

El SCOPING de equipo ya lo resuelve `HistorialObjetivoService` internamente
(via `empleado_ids_scope_por_modulo`, Tarea 3/4) a partir de `current_user` +
`rh_ui_mode` -- este router NO reimplementa esa logica, solo la pasa. Por
eso, a diferencia de `metas`/`ciclo_desempeno` (que resuelven el scope en el
router porque su service no lo hace), aqui no hace falta un
`_resolve_scope()` propio.

Rango de fechas -- DEFAULT "ultimos 12 meses" (Tarea 5, decision explicita):
si el cliente no manda `fecha_inicio`/`fecha_fin`, este router completa el
hueco con `hoy - 365 dias` / `hoy` antes de llamar al service. Motivo: el
service (`HistorialObjetivoService.indice_equipo`) exige un rango explicito
cuando el scope efectivo es universo (RH/director sin equipo delimitado,
`scope_ids is None`) -- nunca agrega TODA la organizacion sin acotar por
fecha. Aplicar el default aqui (capa HTTP) evita que cualquier llamada sin
fechas explote con 422 y le da a todos los llamantes (empleado individual,
equipo, self-service) el mismo comportamiento de "ventana movil de 12 meses"
si no piden algo distinto.

Self-service ("mi historial"): el empleado ve su propio indice
(`GET /mi-historial`), `empleado_id` SIEMPRE del token
(`current_user.empleado_id`), nunca de query/body. Su prefijo esta en
`RH_SELF_SERVICE_API_PREFIXES` para que el middleware de permisos por modulo
no lo bloquee.

Router SIN logica de dominio: solo arma el rango de fechas por default,
instancia `HistorialObjetivoService` y mapea las dataclasses devueltas a los
schemas Pydantic de `app/schemas/historial_objetivo.py`
(`model_validate(..., from_attributes=True)` ya configurado en cada schema).
El mapeo de excepciones de dominio (`NotFoundError` -> 404,
`ForbiddenError` -> 403, `DomainValidationError` -> 422,
`ServiceUnavailableError` -> 503) lo hace el handler global de
`app.core.exceptions`, no este router.
"""

from __future__ import annotations

from datetime import date, timedelta
from io import BytesIO

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_rh_ui_mode, role_checker
from app.models.empleados import Empleado
from app.schemas.historial_objetivo import (
    HistorialObjetivoEmpleadoOut,
    HistorialObjetivoEquipoOut,
)
from app.services.historial_objetivo_service import HistorialObjetivoService

router = APIRouter(prefix="/api/v1/historial-objetivo", tags=["Cumplimiento - Historial Objetivo"])

# "Ultimos 12 meses" -- ventana movil default cuando el cliente no manda
# fecha_inicio/fecha_fin (ver docstring del modulo). 365 dias exactos (sin
# dependencia de dateutil, no está en requirements.txt).
RANGO_DEFAULT_DIAS = 365


def _svc(db: AsyncSession = Depends(get_db)) -> HistorialObjetivoService:
    return HistorialObjetivoService(db)


def _rango_con_default(
    fecha_inicio: date | None, fecha_fin: date | None
) -> tuple[date, date]:
    """Completa el rango con el default de ultimos 12 meses cuando el
    cliente no manda alguno de los dos extremos."""
    hoy = date.today()
    return (
        fecha_inicio if fecha_inicio is not None else hoy - timedelta(days=RANGO_DEFAULT_DIAS),
        fecha_fin if fecha_fin is not None else hoy,
    )


_gestion_role_checker = role_checker(["operativo", "gerente", "supervisor", "director"])


# ══════════════════════════════════════════════════════════════════════════
# Gestion -- RH con modulo 'historial-objetivo' O jefe/director nativo
# (scoping de equipo resuelto DENTRO del service, ver docstring del modulo)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/empleados/{empleado_id}", response_model=HistorialObjetivoEmpleadoOut)
async def indice_empleado(
    empleado_id: int,
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    current_user: Empleado = Depends(_gestion_role_checker),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: HistorialObjetivoService = Depends(_svc),
):
    inicio, fin = _rango_con_default(fecha_inicio, fecha_fin)
    resultado = await svc.indice_empleado(
        current_user, empleado_id, inicio, fin, rh_ui_mode=rh_ui_mode
    )
    return HistorialObjetivoEmpleadoOut.model_validate(resultado)


@router.get("/equipo", response_model=HistorialObjetivoEquipoOut)
async def indice_equipo(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    current_user: Empleado = Depends(_gestion_role_checker),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: HistorialObjetivoService = Depends(_svc),
):
    inicio, fin = _rango_con_default(fecha_inicio, fecha_fin)
    resultado = await svc.indice_equipo(current_user, inicio, fin, rh_ui_mode=rh_ui_mode)
    return HistorialObjetivoEquipoOut.model_validate(resultado)


@router.get("/equipo/export")
async def export_equipo_excel(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    current_user: Empleado = Depends(_gestion_role_checker),
    rh_ui_mode: str | None = Depends(get_rh_ui_mode),
    svc: HistorialObjetivoService = Depends(_svc),
):
    """Exporta a `.xlsx` el ranking de equipo (mismo scoping que `GET /equipo`).

    `HistorialObjetivoService` no expone un export propio (igual que
    `CicloDesempenoService`, ver `app/api/v1/ciclo_desempeno/router.py`): se
    arma aqui, sobre el resultado ya calculado por el service, sin logica de
    dominio -- solo formato de columnas (openpyxl + StreamingResponse, mismo
    patron que metas/ciclo-desempeno).
    """
    from openpyxl import Workbook

    inicio, fin = _rango_con_default(fecha_inicio, fecha_fin)
    resultado = await svc.indice_equipo(current_user, inicio, fin, rh_ui_mode=rh_ui_mode)

    wb = Workbook()
    ws = wb.active
    ws.title = "Historial Objetivo"
    ws.append(
        ["empleado_id", "no_empleado", "nombre", "indice", "semaforo", "penalizacion_total"]
    )
    for item in resultado.items:
        ws.append(
            [
                item.empleado_id,
                item.no_empleado,
                item.nombre,
                item.resultado.indice,
                item.resultado.semaforo,
                item.resultado.penalizacion_total,
            ]
        )

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f"attachment; filename=historial_objetivo_equipo_{inicio.isoformat()}_"
                f"{fin.isoformat()}.xlsx"
            )
        },
    )


# ══════════════════════════════════════════════════════════════════════════
# Self-service -- mi historial (sin permiso de modulo, empleado_id del token)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/mi-historial", response_model=HistorialObjetivoEmpleadoOut)
async def mi_historial(
    fecha_inicio: date | None = Query(None),
    fecha_fin: date | None = Query(None),
    current_user: Empleado = Depends(get_current_user),
    svc: HistorialObjetivoService = Depends(_svc),
):
    inicio, fin = _rango_con_default(fecha_inicio, fecha_fin)
    # `empleado_id` SIEMPRE del token -- no hay forma de que el cliente pida
    # el historial de otro empleado por este endpoint (no acepta empleado_id
    # ni en query ni en body).
    resultado = await svc.indice_empleado(
        current_user, current_user.empleado_id, inicio, fin, rh_ui_mode=None
    )
    return HistorialObjetivoEmpleadoOut.model_validate(resultado)
