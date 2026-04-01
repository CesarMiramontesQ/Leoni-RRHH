# app/services/comedor_service.py
"""
Servicio del dominio comedor.

Responsabilidades:
  - Publicar menu semanal (RH)
  - Registrar seleccion de platillo del empleado
  - Validar acceso via lector de huella (FAIL OPEN)
  - Estadisticas y proyecciones de consumo
"""

import logging
from datetime import date, datetime, timezone
from collections import defaultdict

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.repositories.comedor_repository import (
    ComedorRegistroRepository,
    ComedorRepository,
    MenuSemanalRepository,
)
from app.schemas import PaginatedResponse
from app.schemas.comedor import (
    ComedorRegistroCreate,
    ComedorRegistroResponse,
    ComedorResponse,
    HuellaValidarRequest,
    HuellaValidarResponse,
    MenuSemanalCreate,
    MenuSemanalResponse,
)
from app.utils.audit_logger import audit_background

logger = logging.getLogger(__name__)


class ComedorService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.comedor_repo = ComedorRepository(db)
        self.menu_repo = MenuSemanalRepository(db)
        self.registro_repo = ComedorRegistroRepository(db)

    def _get_rol(self, user: Empleado) -> str:
        return user.rol.nombre if user.rol else ""

    # ── Comedores ──────────────────────────────────────────────

    async def list_comedores(self) -> list[ComedorResponse]:
        comedores = await self.comedor_repo.get_activos()
        return [ComedorResponse.model_validate(c) for c in comedores]

    # ── Menú ───────────────────────────────────────────────────

    async def get_menu(
        self,
        comedor_id: int,
        semana: date,
    ) -> list[MenuSemanalResponse]:
        menus = await self.menu_repo.get_menu_semana(comedor_id=comedor_id, semana=semana)
        return [MenuSemanalResponse.model_validate(m) for m in menus]

    async def publicar_menu(
        self,
        data: MenuSemanalCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> MenuSemanalResponse:
        if self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede publicar menus")

        menu = await self.menu_repo.create({
            **data.model_dump(),
            "created_by": current_user.id,
        })
        await self.db.flush()

        audit_background(
            background_tasks,
            self.db,
            accion="MENU_PUBLICADO",
            modulo="comedor",
            usuario_id=current_user.id,
            entidad_id=menu.id,
            datos_despues={"comedor_id": data.comedor_id, "semana": str(data.semana), "dia": data.dia},
        )
        return MenuSemanalResponse.model_validate(menu)

    # ── Selección de platillo ──────────────────────────────────

    async def registrar_seleccion(
        self,
        data: ComedorRegistroCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ComedorRegistroResponse:
        # Solo un registro por empleado/semana/comedor
        existente = await self.registro_repo.get_registro_semana(
            empleado_id=current_user.id,
            semana=data.semana,
        )
        if existente:
            raise ConflictError(
                detail=f"Ya existe un registro para la semana {data.semana}"
            )

        registro = await self.registro_repo.create({
            **data.model_dump(),
            "empleado_id": current_user.id,
            "acceso_concedido": False,
        })
        await self.db.flush()

        audit_background(
            background_tasks,
            self.db,
            accion="COMEDOR_SELECCION",
            modulo="comedor",
            usuario_id=current_user.id,
            entidad_id=registro.id,
        )
        return ComedorRegistroResponse.model_validate(registro)

    # ── Validación de huella ───────────────────────────────────

    async def validar_huella(
        self,
        data: HuellaValidarRequest,
    ) -> HuellaValidarResponse:
        """
        FAIL OPEN: si no se encuentra el empleado o hay un error de DB,
        se concede acceso para no bloquear el comedor.
        Timeout de 500ms gestionado a nivel de router/nginx.
        """
        try:
            empleado = await self.registro_repo.get_by_huella(data.huella_id)
            if not empleado:
                logger.warning(
                    "Huella no reconocida: %s — FAIL OPEN", data.huella_id
                )
                return HuellaValidarResponse(acceso=True, empleado=None, tipo_platillo="normal")

            # Buscar registro de seleccion de la semana actual
            from datetime import timedelta
            inicio_semana = data.timestamp.date() - timedelta(
                days=data.timestamp.weekday()
            )
            registro = await self.registro_repo.get_registro_semana(
                empleado_id=empleado.id,
                semana=inicio_semana,
            )

            tipo_platillo = registro.tipo_platillo if registro else "normal"

            # Marcar acceso concedido
            if registro:
                await self.registro_repo.update(registro.id, {
                    "acceso_concedido": True,
                    "huella_timestamp": data.timestamp,
                })

            return HuellaValidarResponse(
                acceso=True,
                empleado=f"{empleado.nombre} {empleado.apellido}",
                tipo_platillo=tipo_platillo,
            )

        except Exception as exc:
            # FAIL OPEN — nunca bloquear acceso al comedor por error de sistema
            logger.error("Error en validacion de huella — FAIL OPEN: %s", str(exc))
            return HuellaValidarResponse(acceso=True, empleado=None, tipo_platillo="normal")

    # ── Estadísticas ───────────────────────────────────────────

    async def get_estadisticas(
        self,
        current_user: Empleado,
        semana: date | None = None,
    ) -> dict:
        if self._get_rol(current_user) not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="No tienes permiso para ver estadisticas de comedor")

        semana_ref = semana or date.today()
        from datetime import timedelta
        inicio_semana = semana_ref - timedelta(days=semana_ref.weekday())

        registros = await self.registro_repo.get_registros_semana(semana=inicio_semana)
        total = len(registros)
        normal = sum(1 for r in registros if r.tipo_platillo == "normal")
        dieta = sum(1 for r in registros if r.tipo_platillo == "dieta")
        acceso = sum(1 for r in registros if r.acceso_concedido)

        return {
            "semana": str(inicio_semana),
            "total_registros": total,
            "normal": normal,
            "dieta": dieta,
            "acceso_concedido": acceso,
        }

    async def get_proyecciones(
        self,
        current_user: Empleado,
    ) -> dict:
        if self._get_rol(current_user) not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="No tienes permiso para ver proyecciones")

        registros = await self.registro_repo.get_registros_semanas_recientes(n=4)

        semanas: dict[str, dict[str, int]] = defaultdict(lambda: {"normal": 0, "dieta": 0})
        for r in registros:
            k = str(r.semana)
            semanas[k][r.tipo_platillo] = semanas[k].get(r.tipo_platillo, 0) + 1

        if semanas:
            totales = [v["normal"] + v["dieta"] for v in semanas.values()]
            promedio = sum(totales) / len(totales)
        else:
            promedio = 0

        return {
            "ultimas_4_semanas": dict(semanas),
            "promedio_semanal": round(promedio, 1),
        }
