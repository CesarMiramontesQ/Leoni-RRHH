# app/services/puesto_perfil_service.py
"""
Logica de negocio para Puestos Perfil — Modulo Talento Fase 1.

Responsabilidades:
  - CRUD con codigo proporcionado por el usuario (unico)
  - Versionado automatico en actualizaciones
  - Soft-delete (campo activo)
  - Integracion con Ollama para generacion de descripcion + competencias
"""

import json
import logging
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import GradoPuesto, PuestoPerfil
from app.repositories.grado_puesto_repository import GradoPuestoRepository
from app.repositories.puesto_perfil_repository import PuestoPerfilRepository
from app.schemas.talento import (
    GenerarPerfilIARequest,
    GenerarPerfilIAResponse,
    GradoPerfilItem,
    PerfilTarjetaItem,
    PuestoPerfilCreate,
    PuestoPerfilListResponse,
    PuestoPerfilResponse,
    PuestoPerfilUpdate,
    ResumenTarjetasResponse,
)

logger = logging.getLogger(__name__)


class PuestoPerfilService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PuestoPerfilRepository(db)
        self.grado_repo = GradoPuestoRepository(db)

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _to_response(perfil: PuestoPerfil) -> PuestoPerfilResponse:
        area_nombre = None
        if perfil.area:
            area_nombre = perfil.area.descripcion
        grados = sorted(
            (
                GradoPerfilItem(id=g.grado.id, nombre=g.grado.nombre, orden=g.grado.orden)
                for g in perfil.grados_config
                if g.grado
            ),
            key=lambda x: x.orden,
        )
        return PuestoPerfilResponse(
            id=perfil.id,
            codigo=perfil.codigo,
            nombre=perfil.nombre,
            area_id=perfil.area_id,
            area_nombre=area_nombre,
            grados=grados,
            tipo=perfil.tipo,
            descripcion=perfil.descripcion,
            version=perfil.version,
            activo=perfil.activo,
            created_by=perfil.created_by,
            updated_by=perfil.updated_by,
            created_at=perfil.created_at,
            updated_at=perfil.updated_at,
        )

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    # ── Validadores de grados ─────────────────────────────────────────────────

    async def _validar_grados_consecutivos(
        self, grado_ids: list[int]
    ) -> list[GradoPuesto]:
        if len(set(grado_ids)) != len(grado_ids):
            raise DomainValidationError("La lista de grados contiene duplicados")
        grados = await self.grado_repo.get_activos_by_ids(grado_ids)
        if len(grados) != len(grado_ids):
            faltante = next(iter(set(grado_ids) - {g.id for g in grados}))
            raise NotFoundError(entidad="GradoPuesto", id=faltante)
        ordenes = sorted(g.orden for g in grados)
        if ordenes[-1] - ordenes[0] + 1 != len(ordenes):
            raise DomainValidationError(
                f"Los grados del perfil deben ser consecutivos por orden (recibidos: {ordenes})"
            )
        return sorted(grados, key=lambda g: g.orden)

    async def _validar_grados_libres_en_area(
        self, area_id: int, grado_ids: list[int], exclude_id: int | None = None
    ) -> None:
        ocupados = await self.repo.grados_ocupados_en_area(area_id, grado_ids, exclude_id)
        if ocupados:
            detalle = "; ".join(
                f"'{g}' ya pertenece al perfil '{p}'" for g, p in ocupados
            )
            raise ConflictError(detail=f"Grados ya usados en esta área: {detalle}")

    # ── Resumen Tarjetas ────────────────────────────────────────────────────

    async def resumen_tarjetas(self) -> ResumenTarjetasResponse:
        rows = await self.repo.get_resumen_tarjetas()
        # Recalcular brechas y % cumplimiento como "requisitos que no cumplen el mínimo del
        # puesto+grado del empleado (incluye pendientes)". Reemplaza el conteo del repo.
        from app.services.perfil_funciones_service import PerfilFuncionesService

        perfil_funciones_service = PerfilFuncionesService(self.db)
        brechas_cumpl = await perfil_funciones_service.brechas_cumplimiento_por_perfil(
            [row["id"] for row in rows]
        )
        for row in rows:
            requeridos, cumplen = brechas_cumpl.get(row["id"], (0, 0))
            row["brechas"] = requeridos - cumplen
            row["cumplimiento_pct"] = (
                round(cumplen / requeridos * 100) if requeridos > 0 else 0
            )
        items = [PerfilTarjetaItem(**row) for row in rows]
        return ResumenTarjetasResponse(items=items)

    # ── Listar ───────────────────────────────────────────────────────────────

    async def listar(
        self,
        page: int,
        page_size: int,
        area_id: int | None = None,
        grado_id: int | None = None,
        busqueda: str | None = None,
    ) -> PuestoPerfilListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            area_id=area_id,
            grado_id=grado_id,
            busqueda=busqueda,
        )
        return PuestoPerfilListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    # ── Obtener ──────────────────────────────────────────────────────────────

    async def obtener(self, id: int) -> PuestoPerfilResponse:
        perfil = await self.repo.get_with_relations(id)
        if not perfil:
            raise NotFoundError(entidad="PuestoPerfil", id=id)
        return self._to_response(perfil)

    # ── Crear ────────────────────────────────────────────────────────────────

    async def crear(
        self, data: PuestoPerfilCreate, current_user: Empleado
    ) -> PuestoPerfilResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede crear perfiles de puesto")

        if await self.repo.exists_by_codigo(data.codigo):
            raise ConflictError(
                detail=f"Ya existe un perfil de puesto con el codigo '{data.codigo}'"
            )

        # Verificar duplicado (nombre + area)
        if await self.repo.exists_by_nombre_y_area(data.nombre, data.area_id):
            raise ConflictError(
                detail=f"Ya existe un perfil de puesto con el nombre '{data.nombre}' en esa área"
            )

        await self._validar_grados_consecutivos(data.grado_ids)
        await self._validar_grados_libres_en_area(data.area_id, data.grado_ids)

        perfil = await self.repo.create({
            "codigo": data.codigo,
            "nombre": data.nombre,
            "area_id": data.area_id,
            "tipo": data.tipo,
            "descripcion": data.descripcion,
            "version": 1,
            "activo": True,
            "created_by": current_user.id,
            "updated_by": current_user.id,
        })
        await self.repo.set_grados(perfil.id, data.grado_ids)

        # Reload with relations
        perfil = await self.repo.get_with_relations(perfil.id)
        return self._to_response(perfil)

    # ── Actualizar ───────────────────────────────────────────────────────────

    async def actualizar(
        self, id: int, data: PuestoPerfilUpdate, current_user: Empleado
    ) -> PuestoPerfilResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede actualizar perfiles de puesto")

        perfil = await self.repo.get_with_relations(id)
        if not perfil:
            raise NotFoundError(entidad="PuestoPerfil", id=id)

        # Resolver valores efectivos (enviados o actuales)
        new_nombre = data.nombre if data.nombre is not None else perfil.nombre
        new_area_id = data.area_id if data.area_id is not None else perfil.area_id
        current_grado_ids = await self.repo.get_grado_ids(id)
        new_grado_ids = (
            data.grado_ids if data.grado_ids is not None else sorted(current_grado_ids)
        )

        # Duplicado (nombre + area)
        if new_area_id is not None and await self.repo.exists_by_nombre_y_area(
            new_nombre, new_area_id, exclude_id=id
        ):
            raise ConflictError(
                detail=f"Ya existe un perfil de puesto con el nombre '{new_nombre}' en esa área"
            )

        area_cambio = data.area_id is not None and data.area_id != perfil.area_id
        grados_cambio = data.grado_ids is not None

        # Validar consecutividad si cambian los grados
        if grados_cambio:
            await self._validar_grados_consecutivos(new_grado_ids)

        # Validar grados libres en el area efectiva si cambian grados o area
        if (grados_cambio or area_cambio) and new_area_id is not None:
            await self._validar_grados_libres_en_area(
                new_area_id, new_grado_ids, exclude_id=id
            )

        # No permitir quitar grados en uso (requisitos/tareas/asignaciones activas)
        removidos = list(set(current_grado_ids) - set(new_grado_ids))
        if removidos:
            en_uso = await self.repo.grados_en_uso_por_perfil(id, removidos)
            if en_uso:
                detalle = ", ".join(f"{k}: {v}" for k, v in en_uso.items())
                raise ConflictError(
                    detail=f"No se pueden quitar grados en uso ({detalle})"
                )

        # Construir dict de actualizacion (solo campos enviados)
        update_data: dict = {"updated_by": current_user.id}

        if data.codigo is not None and data.codigo != perfil.codigo:
            if await self.repo.exists_by_codigo(data.codigo, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un perfil de puesto con el codigo '{data.codigo}'"
                )
            update_data["codigo"] = data.codigo
        if data.nombre is not None:
            update_data["nombre"] = data.nombre
        if data.area_id is not None:
            update_data["area_id"] = data.area_id
        if data.tipo is not None:
            update_data["tipo"] = data.tipo
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion

        # Incrementar version
        update_data["version"] = perfil.version + 1

        await self.repo.update(id, update_data)

        if grados_cambio:
            await self.repo.set_grados(id, new_grado_ids)

        # Reload
        perfil = await self.repo.get_with_relations(id)
        return self._to_response(perfil)

    # ── Eliminar ─────────────────────────────────────────────────────────────

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede eliminar perfiles de puesto")

        perfil = await self.repo.get_with_relations(id)
        if not perfil:
            raise NotFoundError(entidad="PuestoPerfil", id=id)

        # Soft delete
        await self.repo.update(id, {"activo": False, "updated_by": current_user.id})

    # ── Generacion con IA ────────────────────────────────────────────────────

    async def generar_con_ia(
        self, id: int, data: GenerarPerfilIARequest, current_user: Empleado
    ) -> GenerarPerfilIAResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede generar perfiles con IA")

        # Verificar que el puesto existe
        perfil = await self.repo.get_with_relations(id)
        if not perfil:
            raise NotFoundError(entidad="PuestoPerfil", id=id)

        area_nombre = data.area_nombre
        if not area_nombre and perfil.area:
            area_nombre = perfil.area.descripcion

        return await self._llamar_ollama_perfil(data.nombre, area_nombre)

    async def _llamar_ollama_perfil(
        self, nombre_puesto: str, area_nombre: str | None
    ) -> GenerarPerfilIAResponse:
        """Llama a Ollama para generar descripcion y competencias del puesto."""
        area_ctx = f" en el area de {area_nombre}" if area_nombre else ""
        prompt = (
            f"Genera un perfil de puesto para '{nombre_puesto}'{area_ctx} en una empresa "
            f"de manufactura automotriz (arneses/cables) en Mexico.\n\n"
            f"Responde UNICAMENTE con un JSON valido con esta estructura exacta:\n"
            f'{{\n'
            f'  "descripcion": "descripcion general del puesto (2-3 oraciones)",\n'
            f'  "competencias_tecnicas": ["competencia1", "competencia2", ...],\n'
            f'  "habilidades_blandas": ["habilidad1", "habilidad2", ...],\n'
            f'  "maquinas_herramientas": ["maquina1", "herramienta2", ...]\n'
            f'}}\n\n'
            f"Genera entre 5-8 competencias tecnicas, 4-6 habilidades blandas, "
            f"y 3-5 maquinas/herramientas relevantes al puesto."
        )

        system = (
            "Eres un especialista en gestion de talento humano y desarrollo organizacional "
            "en la industria automotriz mexicana. Respondes SOLO con JSON valido sin markdown."
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_URL}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": prompt,
                        "system": system,
                        "stream": False,
                        "options": {
                            "temperature": settings.OLLAMA_TEMPERATURE,
                            "num_predict": 1024,
                        },
                    },
                )
                resp.raise_for_status()
                texto = resp.json().get("response", "").strip()

                if not texto:
                    raise ValueError("Respuesta vacia de Ollama")

                # Intentar parsear JSON
                parsed = self._parse_ia_response(texto)
                return parsed

        except httpx.HTTPError as exc:
            logger.warning("Ollama no disponible para generar perfil: %s", exc)
            raise ServiceUnavailableError(
                detail="Servicio de IA no disponible. Intenta mas tarde."
            ) from exc
        except (json.JSONDecodeError, ValueError, KeyError) as exc:
            logger.warning("Error parseando respuesta de Ollama: %s", exc)
            raise ServiceUnavailableError(
                detail="La respuesta de IA no tiene el formato esperado. Intenta nuevamente."
            ) from exc

    @staticmethod
    def _parse_ia_response(texto: str) -> GenerarPerfilIAResponse:
        """Parsea respuesta JSON de Ollama con tolerancia a markdown."""
        # Limpiar posible bloque markdown
        cleaned = texto.strip()
        if cleaned.startswith("```"):
            # Remover ```json y ``` de cierre
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)

        data = json.loads(cleaned)

        return GenerarPerfilIAResponse(
            descripcion=data.get("descripcion", ""),
            competencias_tecnicas=data.get("competencias_tecnicas", []),
            habilidades_blandas=data.get("habilidades_blandas", []),
            maquinas_herramientas=data.get("maquinas_herramientas", []),
        )
