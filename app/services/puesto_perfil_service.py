# app/services/puesto_perfil_service.py
"""
Logica de negocio para Puestos Perfil — Modulo Talento Fase 1.

Responsabilidades:
  - CRUD con auto-generacion de codigo PRF-YYYY-NNN
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
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.models.empleados import Empleado
from app.models.talento import PuestoPerfil
from app.repositories.puesto_perfil_repository import PuestoPerfilRepository
from app.schemas.talento import (
    GenerarPerfilIARequest,
    GenerarPerfilIAResponse,
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

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _to_response(perfil: PuestoPerfil) -> PuestoPerfilResponse:
        area_nombre = None
        if perfil.area:
            area_nombre = perfil.area.descripcion
        return PuestoPerfilResponse(
            id=perfil.id,
            codigo=perfil.codigo,
            nombre=perfil.nombre,
            area_id=perfil.area_id,
            area_nombre=area_nombre,
            nivel=perfil.nivel,
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

    # ── Resumen Tarjetas ────────────────────────────────────────────────────

    async def resumen_tarjetas(self) -> ResumenTarjetasResponse:
        rows = await self.repo.get_resumen_tarjetas()
        items = [PerfilTarjetaItem(**row) for row in rows]
        return ResumenTarjetasResponse(items=items)

    # ── Listar ───────────────────────────────────────────────────────────────

    async def listar(
        self,
        page: int,
        page_size: int,
        area_id: int | None = None,
        nivel: str | None = None,
        busqueda: str | None = None,
    ) -> PuestoPerfilListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            area_id=area_id,
            nivel=nivel,
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
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede crear perfiles de puesto")

        # Verificar duplicado
        if await self.repo.exists_by_nombre(data.nombre):
            raise ConflictError(
                detail=f"Ya existe un perfil de puesto con el nombre '{data.nombre}'"
            )

        # Generar codigo
        codigo = await self.repo.get_next_codigo()

        perfil = await self.repo.create({
            "codigo": codigo,
            "nombre": data.nombre,
            "area_id": data.area_id,
            "nivel": data.nivel,
            "descripcion": data.descripcion,
            "version": 1,
            "activo": True,
            "created_by": current_user.id,
            "updated_by": current_user.id,
        })

        # Reload with relations
        perfil = await self.repo.get_with_relations(perfil.id)
        return self._to_response(perfil)

    # ── Actualizar ───────────────────────────────────────────────────────────

    async def actualizar(
        self, id: int, data: PuestoPerfilUpdate, current_user: Empleado
    ) -> PuestoPerfilResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede actualizar perfiles de puesto")

        perfil = await self.repo.get_with_relations(id)
        if not perfil:
            raise NotFoundError(entidad="PuestoPerfil", id=id)

        # Verificar duplicado de nombre si cambio
        if data.nombre and data.nombre != perfil.nombre:
            if await self.repo.exists_by_nombre(data.nombre, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un perfil de puesto con el nombre '{data.nombre}'"
                )

        # Construir dict de actualizacion (solo campos enviados)
        update_data: dict = {"updated_by": current_user.id}

        if data.nombre is not None:
            update_data["nombre"] = data.nombre
        if data.area_id is not None:
            update_data["area_id"] = data.area_id
        if data.nivel is not None:
            update_data["nivel"] = data.nivel
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion

        # Incrementar version
        update_data["version"] = perfil.version + 1

        await self.repo.update(id, update_data)

        # Reload
        perfil = await self.repo.get_with_relations(id)
        return self._to_response(perfil)

    # ── Eliminar ─────────────────────────────────────────────────────────────

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        rol = self._get_rol(current_user)
        if rol != "rh":
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
        rol = self._get_rol(current_user)
        if rol != "rh":
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
