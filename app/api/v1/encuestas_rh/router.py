# app/api/v1/encuestas_rh/router.py
"""
Router del modulo Encuestas RH (Level Up) — encuestas de clima/pulso.

Convenciones (ver app/api/v1/evaluacion360/router.py):
  - Gestion (CRUD de encuesta/preguntas, audiencia, publicar/cerrar,
    participantes, plantillas) exige `role_checker(["operativo"])`.
  - "Mis encuestas" y responder son self-service (`get_current_user`); su
    prefijo (`/mis-encuestas`) esta en RH_SELF_SERVICE_API_PREFIXES para que
    el middleware de permisos por modulo no lo bloquee. El empleado siempre
    usa `current_user.empleado_id` — nunca un empleado_id del body/cliente.
  - El router instancia el service y delega toda la logica de dominio.
"""

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.core.exceptions import DomainValidationError
from app.models.empleados import Empleado
from app.schemas.encuestas_rh import (
    AudienciaFiltros,
    AudienciaPreview,
    CrearDesdeplantillaRequest,
    EncuestaCreate,
    EncuestaResponse,
    EncuestaUpdate,
    ForzarRecordatoriosResponse,
    MiEncuestaItem,
    ParticipanteItem,
    PlantillaResponse,
    PreguntaCreate,
    PreguntaResponse,
    PreguntaUpdate,
    PublicarRequest,
    ReordenarPreguntasRequest,
    ResponderRequest,
    ResultadosGlobal,
    ResultadosSegmentos,
    TextosResponse,
)
from app.services.encuestas_rh_service import EncuestasRhService

router = APIRouter(prefix="/api/v1/encuestas-rh", tags=["Talento - Encuestas RH"])


def _svc(db: AsyncSession = Depends(get_db)) -> EncuestasRhService:
    return EncuestasRhService(db)


def _split_csv(values: list[str]) -> list[str]:
    """Acepta valores repetidos (`?roles=a&roles=b`) y/o separados por coma
    (`?roles=a,b`) en un mismo query param."""
    resultado: list[str] = []
    for value in values:
        resultado.extend(p.strip() for p in value.split(",") if p.strip())
    return resultado


# ══════════════════════════════════════════════════════════════════════════
# Gestion — encuestas (CRUD)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/encuestas", response_model=list[EncuestaResponse])
async def list_encuestas(
    estado: str | None = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.listar_encuestas(estado=estado)


@router.post("/encuestas", response_model=EncuestaResponse, status_code=status.HTTP_201_CREATED)
async def create_encuesta(
    data: EncuestaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    data = data.model_copy(update={"creado_por_id": current_user.empleado_id})
    return await svc.crear_encuesta(data)


@router.get("/encuestas/{encuesta_id}", response_model=EncuestaResponse)
async def get_encuesta(
    encuesta_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.obtener_encuesta(encuesta_id)


@router.put("/encuestas/{encuesta_id}", response_model=EncuestaResponse)
async def update_encuesta(
    encuesta_id: int,
    data: EncuestaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.actualizar_encuesta(encuesta_id, data)


@router.delete("/encuestas/{encuesta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_encuesta(
    encuesta_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    await svc.eliminar_encuesta(encuesta_id)


# ══════════════════════════════════════════════════════════════════════════
# Gestion — preguntas / opciones (solo borrador)
# ══════════════════════════════════════════════════════════════════════════
@router.post(
    "/encuestas/{encuesta_id}/preguntas",
    response_model=PreguntaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pregunta(
    encuesta_id: int,
    data: PreguntaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.agregar_pregunta(encuesta_id, data)


@router.put("/encuestas/{encuesta_id}/preguntas/reordenar", response_model=list[PreguntaResponse])
async def reordenar_preguntas(
    encuesta_id: int,
    data: ReordenarPreguntasRequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.reordenar_preguntas(encuesta_id, data.pregunta_ids)


@router.put("/encuestas/{encuesta_id}/preguntas/{pregunta_id}", response_model=PreguntaResponse)
async def update_pregunta(
    encuesta_id: int,
    pregunta_id: int,
    data: PreguntaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.actualizar_pregunta(encuesta_id, pregunta_id, data)


@router.delete(
    "/encuestas/{encuesta_id}/preguntas/{pregunta_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_pregunta(
    encuesta_id: int,
    pregunta_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    await svc.eliminar_pregunta(encuesta_id, pregunta_id)


# ══════════════════════════════════════════════════════════════════════════
# Gestion — audiencia / ciclo de vida
# ══════════════════════════════════════════════════════════════════════════
@router.get("/audiencia/preview", response_model=AudienciaPreview)
async def preview_audiencia(
    areas: list[str] = Query(default=[]),
    turnos: list[str] = Query(default=[]),
    roles: list[str] = Query(default=[]),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    area_ids: list[int] = []
    if areas:
        area_values = _split_csv(areas)
        try:
            area_ids = [int(a) for a in area_values]
        except ValueError as e:
            raise DomainValidationError(
                f"areas debe contener valores numéricos válidos (recibido: {', '.join(area_values)})"
            ) from e
    filtros = AudienciaFiltros(
        areas=area_ids,
        turnos=_split_csv(turnos),
        roles=_split_csv(roles),
    )
    return await svc.preview_audiencia(filtros)


@router.post("/encuestas/{encuesta_id}/publicar", response_model=EncuestaResponse)
async def publicar_encuesta(
    encuesta_id: int,
    data: PublicarRequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.publicar_encuesta(encuesta_id, data)


@router.post("/encuestas/{encuesta_id}/cerrar", response_model=EncuestaResponse)
async def cerrar_encuesta(
    encuesta_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.cerrar_encuesta(encuesta_id)


@router.get("/encuestas/{encuesta_id}/participantes", response_model=list[ParticipanteItem])
async def list_participantes(
    encuesta_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.listar_participantes(encuesta_id)


@router.post(
    "/encuestas/{encuesta_id}/recordatorios", response_model=ForzarRecordatoriosResponse
)
async def forzar_recordatorios(
    encuesta_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    """Fuerza un recordatorio a TODOS los participantes pendientes de la
    encuesta, sin respetar la cadencia `recordatorio_cada_dias` (esa cadencia
    solo aplica al job automatico diario)."""
    enviados = await svc.forzar_recordatorios(encuesta_id)
    return ForzarRecordatoriosResponse(recordatorios_enviados=enviados)


# ══════════════════════════════════════════════════════════════════════════
# Gestion — plantillas
# ══════════════════════════════════════════════════════════════════════════
@router.get("/plantillas", response_model=list[PlantillaResponse])
async def list_plantillas(
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.listar_plantillas()


@router.post(
    "/plantillas/{plantilla_id}/crear-encuesta",
    response_model=EncuestaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_encuesta_desde_plantilla(
    plantilla_id: int,
    data: CrearDesdeplantillaRequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.crear_encuesta_desde_plantilla(
        plantilla_id, creado_por_id=current_user.empleado_id, es_anonima=data.es_anonima
    )


# ══════════════════════════════════════════════════════════════════════════
# Gestion — resultados / analitica (Tarea 4)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/encuestas/{encuesta_id}/resultados", response_model=ResultadosGlobal)
async def resultados_globales(
    encuesta_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.obtener_resultados_globales(encuesta_id)


@router.get("/encuestas/{encuesta_id}/resultados/segmentos", response_model=ResultadosSegmentos)
async def resultados_segmentos(
    encuesta_id: int,
    dimension: str = Query(..., description="area|turno|clasificacion"),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.obtener_resultados_segmentos(encuesta_id, dimension)


@router.get("/encuestas/{encuesta_id}/resultados/textos", response_model=TextosResponse)
async def resultados_textos(
    encuesta_id: int,
    pregunta_id: int = Query(...),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.obtener_textos(encuesta_id, pregunta_id)


@router.get("/encuestas/{encuesta_id}/export/excel")
async def export_resultados_excel(
    encuesta_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EncuestasRhService = Depends(_svc),
):
    output, filename = await svc.exportar_resultados_excel(encuesta_id)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ══════════════════════════════════════════════════════════════════════════
# Self-service — mis encuestas (sin permiso de modulo)
# ══════════════════════════════════════════════════════════════════════════
@router.get("/mis-encuestas", response_model=list[MiEncuestaItem])
async def mis_encuestas(
    current_user: Empleado = Depends(get_current_user),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.listar_mis_encuestas(current_user.empleado_id)


@router.get("/mis-encuestas/{encuesta_id}", response_model=EncuestaResponse)
async def mi_encuesta_detalle(
    encuesta_id: int,
    current_user: Empleado = Depends(get_current_user),
    svc: EncuestasRhService = Depends(_svc),
):
    return await svc.obtener_para_responder(encuesta_id, current_user.empleado_id)


@router.post("/mis-encuestas/{encuesta_id}/responder", status_code=status.HTTP_204_NO_CONTENT)
async def responder_encuesta(
    encuesta_id: int,
    data: ResponderRequest,
    current_user: Empleado = Depends(get_current_user),
    svc: EncuestasRhService = Depends(_svc),
):
    # `empleado_id` SIEMPRE del token — nunca del cliente (ResponderRequest no
    # tiene ese campo en el schema, asi que no hay forma de que el body lo cuele).
    await svc.responder(encuesta_id, current_user.empleado_id, data)
