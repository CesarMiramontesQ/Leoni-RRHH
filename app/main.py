import logging
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.middleware import RhModulePermissionMiddleware, SupervisorRestrictedRoutesMiddleware
from app.core.exceptions import EXCEPTION_STATUS_MAP, LeoniException

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _it_mirror_sync_job():
    """Ejecuta sincronizacion IT Mirror → BD local en event loop principal."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.integrations.tress.tress_sync_service import TressSyncService

        async with AsyncSessionLocal() as db:
            service = TressSyncService(db)
            resultado = await service.sincronizar_empleados()
            logger.info("IT Mirror sync completado: %s", resultado)
    except Exception as exc:
        logger.error("Error en IT Mirror sync job: %s", str(exc), exc_info=True)


async def _tress_scheduler_job():
    """Procesa la cola de operaciones TRESS pendientes."""
    try:
        from app.integrations.tress.tress_scheduler import procesar_cola_tress

        await procesar_cola_tress()
    except Exception as exc:
        logger.error("Error en TRESS scheduler job: %s", str(exc), exc_info=True)


async def _bono_historico_import_job():
    """Importa calidad_historico y seguridad_historico desde bono_productividad."""
    try:
        from app.integrations.bono_historico_nightly import ejecutar_importaciones_bono_historico

        await ejecutar_importaciones_bono_historico()
    except Exception as exc:
        logger.error(
            "Error en job import bono histórico: %s",
            str(exc),
            exc_info=True,
        )


async def _bono_empleados_import_job():
    """Sincroniza empleados desde bono_productividad.empleados hacia BD principal."""
    try:
        from app.integrations.bono_empleados_import import importar_empleados_bono_job

        await importar_empleados_bono_job()
    except Exception as exc:
        logger.error(
            "Error en job import empleados bono: %s",
            str(exc),
            exc_info=True,
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

    # 2. APScheduler — jobs de sincronizacion periodica
    scheduler.add_job(
        _it_mirror_sync_job,
        "interval",
        minutes=settings.IT_SYNC_INTERVAL_MINUTES,
        id="it_mirror_sync",
    )
    scheduler.add_job(
        _tress_scheduler_job,
        "interval",
        minutes=5,
        id="tress_scheduler",
    )
    if settings.BONO_CALIDAD_HISTORICO_IMPORT_ENABLED:
        tz = ZoneInfo(settings.APP_TIMEZONE)
        scheduler.add_job(
            _bono_historico_import_job,
            CronTrigger(
                hour=settings.BONO_CALIDAD_HISTORICO_IMPORT_CRON_HOUR,
                minute=settings.BONO_CALIDAD_HISTORICO_IMPORT_CRON_MINUTE,
                timezone=tz,
            ),
            id="bono_historico_import",
            replace_existing=True,
        )
        logger.info(
            "Job bono_historico_import (calidad, seguridad, importadas, evaluación) programado a las %02d:%02d (%s)",
            settings.BONO_CALIDAD_HISTORICO_IMPORT_CRON_HOUR,
            settings.BONO_CALIDAD_HISTORICO_IMPORT_CRON_MINUTE,
            settings.APP_TIMEZONE,
        )
    else:
        logger.info("Job bono_historico_import deshabilitado (config)")
    if settings.BONO_EMPLEADOS_IMPORT_ENABLED:
        scheduler.add_job(
            _bono_empleados_import_job,
            "interval",
            minutes=settings.BONO_EMPLEADOS_IMPORT_INTERVAL_MINUTES,
            id="bono_empleados_import",
            replace_existing=True,
        )
        logger.info(
            "Job bono_empleados_import programado cada %s minutos",
            settings.BONO_EMPLEADOS_IMPORT_INTERVAL_MINUTES,
        )
    else:
        logger.info("Job bono_empleados_import deshabilitado (config)")
    scheduler.start()
    logger.info("APScheduler iniciado con %d jobs", len(scheduler.get_jobs()))

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
from app.api.v1.tareas_catalogo.router import router as tareas_catalogo_router
from app.api.v1.niveles_puesto.router import router as niveles_puesto_router
from app.api.v1.tipos_competencia.router import router as tipos_competencia_router
from app.api.v1.grupos_competencia.router import router as grupos_competencia_router
from app.api.v1.perfil_funciones.router import router as perfil_funciones_router
from app.api.v1.cualificaciones_catalogo.router import router as cualificaciones_catalogo_router
from app.api.v1.rh_permisos.router import router as rh_permisos_router

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
app.include_router(level_up_curso_sesiones_router)
app.include_router(all_sesiones_router)
app.include_router(tareas_catalogo_router)
app.include_router(niveles_puesto_router)
app.include_router(tipos_competencia_router)
app.include_router(grupos_competencia_router)
app.include_router(perfil_funciones_router)
app.include_router(cualificaciones_catalogo_router)
app.include_router(rh_permisos_router)


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
