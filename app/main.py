import logging
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.middleware import (
    RhModulePermissionMiddleware,
    SupervisorRestrictedRoutesMiddleware,
    VistaRolPermissionMiddleware,
)
from app.core.exceptions import EXCEPTION_STATUS_MAP, LeoniException

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone=ZoneInfo(settings.APP_TIMEZONE))


async def _tress_scheduler_job():
    """
    DEPRECATED: la cola RPA / tress_robot_queue ya no se usa.

    La integración con nómina es escritura directa a DATOS_ANALISIS.
    Este job no se registra en el scheduler; se conserva solo por compatibilidad
    si alguien lo invoca manualmente.
    """
    logger.warning(
        "tress_scheduler invocado pero está deprecado (sin RPA); no-op. "
        "Usar INSERT directo a DATOS_ANALISIS."
    )


async def _eval360_recordatorios_job():
    """Recordatorios de Evaluación 360 y marcado de evaluaciones vencidas (diario)."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.evaluacion360_service import Evaluacion360Service

        async with AsyncSessionLocal() as db:
            resultado = await Evaluacion360Service(db).procesar_recordatorios()
            await db.commit()
        logger.info(
            "Eval360 recordatorios | enviados=%d | vencidas=%d",
            resultado.recordatorios_enviados,
            resultado.vencidas_marcadas,
        )
    except Exception as exc:
        logger.error("Error en Eval360 recordatorios job: %s", str(exc), exc_info=True)


async def _encuestas_rh_recordatorios_job():
    """Cierre automático de encuestas vencidas + recordatorios a participantes
    pendientes de Encuestas RH (diario)."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.encuestas_rh_service import EncuestasRhService

        async with AsyncSessionLocal() as db:
            resultado = await EncuestasRhService(db).procesar_recordatorios()
            await db.commit()
        logger.info(
            "Encuestas RH recordatorios | cerradas=%d | recordatorios_enviados=%d",
            resultado.encuestas_cerradas,
            resultado.recordatorios_enviados,
        )
    except Exception as exc:
        logger.error("Error en Encuestas RH recordatorios job: %s", str(exc), exc_info=True)


async def _metas_recordatorios_job():
    """Recordatorios de Metas (OKR): ciclos activos próximos a cerrar y
    resultados clave sin check-in reciente (diario)."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.metas_service import MetasService

        async with AsyncSessionLocal() as db:
            resultado = await MetasService(db).procesar_recordatorios()
            await db.commit()
        logger.info(
            "Metas recordatorios | notificados=%d | ciclos_por_cerrar=%d",
            resultado.notificados,
            resultado.ciclos_por_cerrar,
        )
    except Exception as exc:
        logger.error("Error en Metas recordatorios job: %s", str(exc), exc_info=True)


async def _sync_vacaciones_disponibles_job():
    """Refresca la caché de saldos de vacaciones desde DATOS_ANALISIS (diario, 06:00).

    Es lo que permite que dashboards y formularios lean el saldo de Bono en vez de esperar
    a la BD de nómina en cada carga de página.
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.sync_vacaciones_disponibles_service import (
            sincronizar_vacaciones_disponibles,
        )

        async with AsyncSessionLocal() as db:
            stats = await sincronizar_vacaciones_disponibles(db, origen="scheduler")
        logger.info(
            "Sync vacaciones disponibles job | consultados=%d | insertados=%d | "
            "actualizados=%d | omitidos=%d | errores=%d",
            stats.consultados,
            stats.insertados,
            stats.actualizados,
            stats.omitidos,
            stats.errores,
        )
    except Exception as exc:
        logger.error(
            "Error en sync de vacaciones disponibles job: %s", str(exc), exc_info=True
        )


async def _sync_homeoffice_tomados_job():
    """Refresca la caché de home office tomado desde DATOS_ANALISIS (diario, 06:00).

    Job aparte del de vacaciones aunque compartan hora: un fallo de uno no debe impedir el
    otro.
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.sync_homeoffice_tomados_service import (
            sincronizar_homeoffice_tomados,
        )

        async with AsyncSessionLocal() as db:
            stats = await sincronizar_homeoffice_tomados(db, origen="scheduler")
        logger.info(
            "Sync home office job | consultados=%d | insertados=%d | actualizados=%d "
            "| omitidos=%d",
            stats.consultados,
            stats.insertados,
            stats.actualizados,
            stats.omitidos,
        )
    except Exception as exc:
        logger.error("Error en sync de home office job: %s", str(exc), exc_info=True)


async def _sync_incidencias_tress_job():
    """Refresca la caché de incidencias desde DATOS_ANALISIS (semanal, miércoles 10:00).

    Relee una ventana móvil de semanas en vez de solo la anterior: nómina captura y
    corrige de forma retroactiva. Nunca propaga la excepción — un fallo de TRESS no debe
    tumbar el scheduler, y la caché queda como estaba.
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.sync_incidencias_tress_service import (
            rango_semanas,
            sincronizar_incidencias_tress,
        )

        desde, hasta = rango_semanas(settings.SYNC_INCIDENCIAS_TRESS_SEMANAS)
        async with AsyncSessionLocal() as db:
            stats = await sincronizar_incidencias_tress(
                db, desde=desde, hasta=hasta, origen="scheduler"
            )
        logger.info(
            "Sync incidencias job | desde=%s | hasta=%s | leidos=%d | insertados=%d | "
            "actualizados=%d | omitidos=%d | eliminados=%d | errores=%d",
            desde,
            hasta,
            stats.leidos,
            stats.insertados,
            stats.actualizados,
            stats.omitidos,
            stats.eliminados,
            stats.errores,
        )
    except Exception as e:  # noqa: BLE001 — el scheduler no debe caerse por esto
        logger.error(
            "Error en job de sync de incidencias: %s: %s", type(e).__name__, str(e), exc_info=True
        )


def registrar_jobs_programados(sched: AsyncIOScheduler) -> None:
    """Registra los jobs periódicos. La zona horaria la fija el scheduler (APP_TIMEZONE)."""
    # Recordatorios Evaluación 360: una vez al día (08:00).
    sched.add_job(
        _eval360_recordatorios_job,
        "cron",
        hour=8,
        minute=0,
        id="eval360_recordatorios",
    )
    # Recordatorios + cierre automático Encuestas RH: una vez al día (08:00).
    sched.add_job(
        _encuestas_rh_recordatorios_job,
        "cron",
        hour=8,
        minute=0,
        id="encuestas_rh_recordatorios",
    )
    # Recordatorios de Metas (OKR): una vez al día (08:00).
    sched.add_job(
        _metas_recordatorios_job,
        "cron",
        hour=8,
        minute=0,
        id="metas_recordatorios",
    )
    # Caché de saldos de vacaciones: una vez al día (06:00), antes de la jornada.
    sched.add_job(
        _sync_vacaciones_disponibles_job,
        "cron",
        hour=6,
        minute=0,
        id="sync_vacaciones_disponibles",
    )
    # Caché de home office tomado: una vez al día (06:00), antes de la jornada.
    sched.add_job(
        _sync_homeoffice_tomados_job,
        "cron",
        hour=6,
        minute=0,
        id="sync_homeoffice_tomados",
    )
    # Caché de incidencias de TRESS: semanal, miércoles a las 10:00.
    sched.add_job(
        _sync_incidencias_tress_job,
        "cron",
        day_of_week="wed",
        hour=10,
        minute=0,
        id="sync_incidencias_tress",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──────────────────────────────────────────────
    logger.info("Iniciando Plataforma RH Leoni Cable...")

    # 1. Health check Ollama — no bloqueante, solo warning si no responde
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            if resp.status_code == 200:
                logger.info("Ollama disponible en %s", settings.OLLAMA_URL)
            else:
                logger.warning("Ollama respondio con status %s", resp.status_code)
    except (httpx.ConnectError, httpx.TimeoutException, Exception) as e:
        logger.warning(
            "Ollama no disponible en startup (%s: %s) — continuando sin IA local",
            type(e).__name__,
            str(e),
        )

    # 2. APScheduler — jobs periódicos (sin cola TRESS/RPA; nómina = DATOS_ANALISIS directo)
    registrar_jobs_programados(scheduler)
    scheduler.start()
    logger.info("APScheduler iniciado con %d jobs", len(scheduler.get_jobs()))

    # 3. Bootstrap/recuperación de administradores de permisos RH (no bloqueante).
    #    Solo escribe si NO hay ningún admin en BD (recuperación desde `.env`);
    #    en operación normal es no-op y la BD/UI es la autoridad.
    try:
        from app.core.database import AsyncSessionLocal
        from app.utils.seed import ensure_bootstrap_rh_admins

        async with AsyncSessionLocal() as db:
            await ensure_bootstrap_rh_admins(db)
            await db.commit()
    except Exception as e:  # noqa: BLE001 — el arranque no debe fallar por esto
        logger.warning(
            "Bootstrap de administradores de permisos RH omitido (%s: %s)",
            type(e).__name__,
            str(e),
        )

    # 4. Configuración inicial de vistas por rol (no bloqueante). Solo inserta las
    #    filas que falten, así una vista recién agregada al catálogo aparece con su
    #    valor por defecto sin pisar lo que el admin RH haya configurado.
    try:
        from app.core.database import AsyncSessionLocal
        from app.utils.seed_vistas_rol import ensure_vistas_rol_defaults

        async with AsyncSessionLocal() as db:
            await ensure_vistas_rol_defaults(db)
            await db.commit()
    except Exception as e:  # noqa: BLE001 — el arranque no debe fallar por esto
        logger.warning(
            "Seed de vistas por rol omitido (%s: %s)", type(e).__name__, str(e)
        )

    logger.info("Plataforma RH lista — entorno: %s", settings.APP_ENV)

    yield

    # ── SHUTDOWN ─────────────────────────────────────────────
    logger.info("Apagando Plataforma RH...")
    scheduler.shutdown(wait=False)
    logger.info("APScheduler detenido")


# ── FastAPI App ───────────────────────────────────────────────
app = FastAPI(
    title="Plataforma RH Leoni Cable",
    version="1.0.0",
    description=(
        "Sistema enterprise On-Premise de Recursos Humanos para Leoni Cable. "
        "Gestión de solicitudes, incidencias, actas administrativas, "
        "comedor con lector de huella y analítica de empleados."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.APP_ENV == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Después de CORS: bloquea `supervisor` en actas y reportes de comedor (API) antes del router.
app.add_middleware(SupervisorRestrictedRoutesMiddleware)
app.add_middleware(RhModulePermissionMiddleware)
# Vistas apagadas por el admin RH para un rol base: 403 antes del router, para que
# entrar por URL directa tampoco funcione.
app.add_middleware(VistaRolPermissionMiddleware)

# ── Exception Handlers ────────────────────────────────────────
def _validation_errors_json_safe(errors: list) -> list:
    """Normaliza ctx de Pydantic (puede contener excepciones) para JSONResponse."""
    out: list = []
    for err in errors:
        e = dict(err)
        ctx = e.get("ctx")
        if isinstance(ctx, dict):
            e["ctx"] = {k: str(v) for k, v in ctx.items()}
        elif ctx is not None:
            e["ctx"] = str(ctx)
        out.append(e)
    return out


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": _validation_errors_json_safe(exc.errors()),
            "body": str(exc.body),
        },
    )


@app.exception_handler(LeoniException)
async def leoni_exception_handler(request: Request, exc: LeoniException):
    """Convierte excepciones de dominio a JSONResponse con el status HTTP correcto."""
    status_code = EXCEPTION_STATUS_MAP.get(type(exc), 400)
    return JSONResponse(
        status_code=status_code,
        content={
            "code": exc.code,
            "detail": exc.detail,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Error no controlado: %s", str(exc), exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Error interno del servidor"},
    )


# ── Routers ───────────────────────────────────────────────────
from app.api.v1.auth.router import router as auth_router
from app.api.v1.usuarios.router import router as usuarios_router
from app.api.v1.solicitudes.router import router as solicitudes_router
from app.api.v1.incidencias.router import router as incidencias_router
from app.api.v1.actas.router import router as actas_router
from app.api.v1.empleados.router import router as empleados_router
from app.api.v1.comedor.router import router as comedor_router
from app.api.v1.reportes.router import router as reportes_router
from app.api.v1.notificaciones.router import router as notificaciones_router
from app.api.v1.organigrama.router import router as organigrama_router
from app.api.v1.puestos_perfil.router import router as puestos_perfil_router
from app.api.v1.competencias.router import router as competencias_router
from app.api.v1.bono_productividad.router import router as bono_productividad_router
from app.api.v1.evaluaciones.router import router as evaluaciones_router
from app.api.v1.capacitaciones.router import router as capacitaciones_router
from app.api.v1.level_up.router_habilidades import router as level_up_habilidades_router
from app.api.v1.level_up.router_cursos import router as level_up_cursos_router
from app.api.v1.level_up.router_curso_sesiones import router as level_up_curso_sesiones_router, all_sesiones_router
from app.api.v1.level_up.router_cursos_dashboard import router as level_up_cursos_dashboard_router
from app.api.v1.level_up.router_curso_encuestas import (
    admin_router as level_up_encuestas_admin_router,
    dashboard_router as level_up_encuestas_dashboard_router,
    empleado_router as level_up_encuestas_empleado_router,
)
from app.api.v1.level_up.router_cursos_catalogo import router as cursos_catalogo_router
from app.api.v1.tareas_catalogo.router import router as tareas_catalogo_router
from app.api.v1.grados_puesto.router import router as grados_puesto_router
from app.api.v1.metodos_calificacion_competencia.router import (
    router as metodos_calificacion_competencia_router,
)
from app.api.v1.tipos_competencia.router import router as tipos_competencia_router
from app.api.v1.grupos_competencia.router import router as grupos_competencia_router
from app.api.v1.clasificacion_puesto.router import router as clasificacion_puesto_router
from app.api.v1.categorias_tarea.router import router as categorias_tarea_router
from app.api.v1.perfil_funciones.router import router as perfil_funciones_router
from app.api.v1.cualificaciones_catalogo.router import router as cualificaciones_catalogo_router
from app.api.v1.rh_permisos.router import router as rh_permisos_router
from app.api.v1.vistas_rol.router import router as vistas_rol_router
from app.api.v1.dashboard_kpis.router import router as dashboard_kpis_router
from app.api.v1.nominas.router import router as nominas_router
from app.api.v1.horas_extra.router import router as horas_extra_router
from app.api.v1.faltas_retardos.router import router as faltas_retardos_router
from app.api.v1.viajes_laborales.router import router as viajes_laborales_router
from app.api.v1.evaluacion360.router import router as evaluacion360_router
from app.api.v1.encuestas_rh.router import router as encuestas_rh_router
from app.api.v1.metas.router import router as metas_router
from app.api.v1.ciclo_desempeno.router import router as ciclo_desempeno_router
from app.api.v1.historial_objetivo.router import router as historial_objetivo_router
from app.api.v1.juntas.router import router as juntas_router
from app.api.v1.proveedores_externos.router import router as proveedores_externos_router
from app.api.v1.sugerencias import router as sugerencias_router
from app.api.v1.evidencias import router as evidencias_router
from app.api.v1.opls import router as opls_router
from app.api.v1.operaciones.router import router as operaciones_router
from app.api.v1.talento.router import router as talento_router

app.include_router(auth_router)
app.include_router(usuarios_router)
app.include_router(solicitudes_router)
app.include_router(incidencias_router)
app.include_router(actas_router)
app.include_router(empleados_router)
app.include_router(comedor_router)
app.include_router(reportes_router)
app.include_router(notificaciones_router)
app.include_router(organigrama_router)
app.include_router(puestos_perfil_router)
app.include_router(competencias_router)
app.include_router(bono_productividad_router)
app.include_router(evaluaciones_router)
app.include_router(capacitaciones_router)
app.include_router(level_up_habilidades_router)
app.include_router(level_up_cursos_router)
app.include_router(level_up_cursos_dashboard_router)
app.include_router(level_up_encuestas_dashboard_router)
app.include_router(level_up_encuestas_admin_router)
app.include_router(level_up_encuestas_empleado_router)
app.include_router(level_up_curso_sesiones_router)
app.include_router(all_sesiones_router)
app.include_router(cursos_catalogo_router)
app.include_router(tareas_catalogo_router)
app.include_router(grados_puesto_router)
app.include_router(metodos_calificacion_competencia_router)
app.include_router(tipos_competencia_router)
app.include_router(grupos_competencia_router)
app.include_router(clasificacion_puesto_router)
app.include_router(categorias_tarea_router)
app.include_router(perfil_funciones_router)
app.include_router(cualificaciones_catalogo_router)
app.include_router(rh_permisos_router)
app.include_router(vistas_rol_router)
app.include_router(dashboard_kpis_router)
app.include_router(nominas_router)
app.include_router(horas_extra_router)
app.include_router(faltas_retardos_router)
app.include_router(viajes_laborales_router)
app.include_router(evaluacion360_router)
app.include_router(encuestas_rh_router)
app.include_router(metas_router)
app.include_router(ciclo_desempeno_router)
app.include_router(historial_objetivo_router)
app.include_router(juntas_router)
app.include_router(proveedores_externos_router)
app.include_router(sugerencias_router)
app.include_router(evidencias_router)
app.include_router(opls_router)
app.include_router(operaciones_router)
app.include_router(talento_router)


# ── Root ──────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {
        "app": "Plataforma RH Leoni Cable",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "env": settings.APP_ENV,
    }


@app.get("/health", tags=["Root"])
async def health():
    return {"status": "ok"}
