"""
Importación de empleados desde bono_productividad.empleados → BD principal.

- Clave de negocio: ``empleado_id`` (único en ambas bases); respaldo por ``no_empleado``.
- No importa ni sobrescribe ``email`` ni ``rol_id``.
- ``password_hash`` se toma de la columna ``password`` en bono (bcrypt o texto legado).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.core.security import SYNC_PLACEHOLDER_PASSWORD_HASH
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.integrations.empleados_catalog_sync import sincronizar_catalogos_desde_bd
from app.models.empleados import Empleado
from app.models.roles import Rol
from app.repositories.empleado_repository import EmpleadoRepository

logger = logging.getLogger(__name__)

_SQL_EMPLEADOS_BONO = """
SELECT
    empleado_id,
    no_empleado,
    no_sap,
    nombre,
    password,
    usuario,
    categoria_id,
    subarea_id,
    puesto_id,
    estado_id,
    area_id,
    clasificacion_id,
    lider_id,
    centrocosto_id,
    foto,
    recibe_bono,
    brigada,
    registro,
    fecha_fin_contrato,
    a_restringido,
    requiere_cambio_password
FROM empleados
ORDER BY empleado_id ASC
"""

_CAMPOS_IMPORTABLES = (
    "empleado_id",
    "no_empleado",
    "no_sap",
    "nombre",
    "usuario",
    "categoria_id",
    "subarea_id",
    "puesto_id",
    "estado_id",
    "area_id",
    "clasificacion_id",
    "centrocosto_id",
    "foto",
    "recibe_bono",
    "brigada",
    "registro",
    "fecha_fin_contrato",
    "a_restringido",
    "requiere_cambio_password",
)


@dataclass
class BonoEmpleadosImportStats:
    leidos: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0
    errores: int = 0
    mensajes_error: list[str] = field(default_factory=list)

    def registrar_error(self, mensaje: str, *, max_errores: int = 200) -> None:
        self.errores += 1
        if len(self.mensajes_error) < max_errores:
            self.mensajes_error.append(mensaje)


def _texto(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_fecha(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


def _normalizar_no_empleado(value: Any) -> str | None:
    raw = _texto(value)
    if not raw:
        return None
    if raw.endswith(".0") and raw[:-2].isdigit():
        return raw[:-2]
    return raw


def validar_fila_empleado_bono(row: dict) -> tuple[dict | None, str | None]:
    empleado_id = _safe_int(row.get("empleado_id"))
    no_empleado = _normalizar_no_empleado(row.get("no_empleado"))
    nombre = _texto(row.get("nombre"))

    if empleado_id is None:
        return None, "empleado_id ausente o inválido"
    if not no_empleado:
        return None, f"empleado_id={empleado_id}: no_empleado ausente"
    if not nombre:
        return None, f"empleado_id={empleado_id}: nombre ausente"

    payload: dict[str, Any] = {
        "empleado_id": empleado_id,
        "no_empleado": no_empleado,
        "nombre": nombre,
        "no_sap": _texto(row.get("no_sap")),
        "usuario": _texto(row.get("usuario")),
        "categoria_id": _safe_int(row.get("categoria_id")),
        "subarea_id": _safe_int(row.get("subarea_id")),
        "puesto_id": _safe_int(row.get("puesto_id")),
        "estado_id": _safe_int(row.get("estado_id")),
        "area_id": _safe_int(row.get("area_id")),
        "clasificacion_id": _safe_int(row.get("clasificacion_id")),
        "centrocosto_id": _safe_int(row.get("centrocosto_id")),
        "foto": _texto(row.get("foto")),
        "recibe_bono": row.get("recibe_bono"),
        "brigada": _texto(row.get("brigada")),
        "registro": _parse_fecha(row.get("registro")),
        "fecha_fin_contrato": _parse_fecha(row.get("fecha_fin_contrato")),
        "a_restringido": row.get("a_restringido"),
        "requiere_cambio_password": row.get("requiere_cambio_password"),
        "lider_empleado_id": _safe_int(row.get("lider_id")),
        # Columna ``password`` en bono → ``password_hash`` local (verify_password acepta bcrypt o legado)
        "password_hash": _texto(row.get("password")),
    }
    return payload, None


class BonoEmpleadosSyncService:
    def __init__(self, rh_db: AsyncSession):
        self.rh_db = rh_db
        self.repo = EmpleadoRepository(rh_db)

    async def sincronizar_empleados(
        self, *, execute: bool = True, commit: bool = True
    ) -> BonoEmpleadosImportStats:
        stats = BonoEmpleadosImportStats()
        engine = BonoProductividadReadClient.create_read_engine()
        if engine is None:
            raise ConnectionError(
                "Base bono_productividad no configurada (variables BONO_DB_*)."
            )

        bono_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        try:
            async with bono_factory() as bono_db:
                await sincronizar_catalogos_desde_bd(
                    bono_db, self.rh_db, log_prefix="BONO_CATALOG_SYNC"
                )

                try:
                    result = await bono_db.execute(text(_SQL_EMPLEADOS_BONO))
                except Exception as exc:
                    if "fecha_fin_contrato" in str(exc).lower():
                        sql_sin_fecha = _SQL_EMPLEADOS_BONO.replace(
                            "    fecha_fin_contrato,\n", ""
                        )
                        result = await bono_db.execute(text(sql_sin_fecha))
                    else:
                        raise

                filas = [dict(r) for r in result.mappings().all()]
                stats.leidos = len(filas)

                lider_index = await self._index_empleados_por_empleado_id()

                for row in filas:
                    payload, err = validar_fila_empleado_bono(row)
                    if err or payload is None:
                        stats.omitidos += 1
                        stats.registrar_error(err or "fila inválida")
                        continue

                    try:
                        op = await self._sync_fila(
                            payload,
                            execute=execute,
                            lider_index=lider_index,
                        )
                        if op == "insertado":
                            stats.insertados += 1
                        elif op == "actualizado":
                            stats.actualizados += 1
                        else:
                            stats.omitidos += 1
                    except Exception as exc:
                        stats.registrar_error(
                            f"empleado_id={payload.get('empleado_id')}: "
                            f"{type(exc).__name__}: {exc}"
                        )

                if execute:
                    if commit:
                        await self.rh_db.commit()
                    else:
                        await self.rh_db.flush()
                else:
                    await self.rh_db.rollback()
        finally:
            await engine.dispose()

        if stats.actualizados:
            stats.mensajes_error.insert(0, f"actualizados={stats.actualizados}")
        return stats

    async def _rol_empleado_default(self) -> Rol:
        result = await self.rh_db.execute(
            select(Rol).where(Rol.nombre == "empleado").limit(1)
        )
        rol = result.scalar_one_or_none()
        if rol is None:
            raise ValueError("Rol 'empleado' no encontrado — ejecutar seed de roles")
        return rol

    async def _index_empleados_por_empleado_id(self) -> dict[int, int | None]:
        result = await self.rh_db.execute(
            select(Empleado.empleado_id, Empleado.id)
        )
        return {row[0]: row[1] for row in result.all()}

    async def _resolver_lider_local_id(
        self,
        lider_empleado_id: int | None,
        lider_index: dict[int, int | None],
    ) -> int | None:
        if lider_empleado_id is None:
            return None
        cached = lider_index.get(lider_empleado_id)
        if cached is not None:
            return cached
        lider = await self.repo.get_by_empleado_id(lider_empleado_id)
        local_id = lider.id if lider else None
        lider_index[lider_empleado_id] = local_id
        return local_id

    async def _sync_fila(
        self,
        payload: dict,
        *,
        execute: bool,
        lider_index: dict[int, int | None],
    ) -> str:
        empleado_id = payload["empleado_id"]
        existente = await self.repo.get_by_empleado_id(empleado_id)
        if existente is None:
            existente = await self.repo.get_by_no_empleado(payload["no_empleado"])

        if (
            existente is not None
            and existente.empleado_id != empleado_id
        ):
            raise ValueError(
                f"no_empleado={payload['no_empleado']!r} ya existe con "
                f"empleado_id={existente.empleado_id} (bono envía {empleado_id})"
            )

        lider_local_id = await self._resolver_lider_local_id(
            payload.pop("lider_empleado_id", None),
            lider_index,
        )

        password_hash_bono = payload.pop("password_hash", None)

        campos = {
            k: payload[k]
            for k in _CAMPOS_IMPORTABLES
            if k in payload
        }
        campos["lider_id"] = lider_local_id

        if existente is None:
            if not execute:
                return "insertado"
            rol_empleado = await self._rol_empleado_default()
            nuevo = Empleado(
                password_hash=password_hash_bono or SYNC_PLACEHOLDER_PASSWORD_HASH,
                rol_id=rol_empleado.id,
                email=None,
                **campos,
            )
            self.rh_db.add(nuevo)
            await self.rh_db.flush()
            lider_index[empleado_id] = nuevo.id
            return "insertado"

        hubo_cambio = False
        for campo, valor in campos.items():
            if campo == "empleado_id" and existente.empleado_id == valor:
                continue
            if getattr(existente, campo) != valor:
                setattr(existente, campo, valor)
                hubo_cambio = True

        if password_hash_bono and existente.password_hash != password_hash_bono:
            existente.password_hash = password_hash_bono
            hubo_cambio = True

        if not execute:
            return "actualizado" if hubo_cambio else "sin_cambios"

        if hubo_cambio:
            await self.rh_db.flush()
            return "actualizado"
        return "sin_cambios"
