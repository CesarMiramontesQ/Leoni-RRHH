# app/services/empleado_foto_service.py
"""Resolución y lectura de fotografías de empleados desde almacenamiento en red (RH/Images)."""

from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.models.empleados import Empleado
from app.repositories.empleado_repository import EmpleadoRepository
from app.services.usuario_service import UsuarioService

_FOTO_EXTENSIONS = (".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG")
_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}
_UNSAFE_NAME = re.compile(r"[\\/]|^\.\.?$")


def _normalize_no_empleado_key(no_empleado: str) -> str:
    s = (no_empleado or "").strip()
    if not s:
        return ""
    try:
        n = float(s)
        if n.is_integer() or abs(n - int(n)) < 1e-9:
            return str(int(n))
    except ValueError:
        pass
    return s


def _safe_basename(name: str) -> str | None:
    base = Path(name.strip()).name
    if not base or _UNSAFE_NAME.search(base):
        return None
    return base


class EmpleadoFotoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EmpleadoRepository(db)
        self._usuarios = UsuarioService(db)

    def _base_dir(self) -> Path | None:
        raw = (settings.RH_EMPLEADO_FOTOS_DIR or "").strip()
        if not raw:
            return None
        return Path(raw)

    def resolve_foto_path(
        self,
        no_empleado: str,
        foto_hint: str | None = None,
    ) -> Path | None:
        base = self._base_dir()
        if base is None or not base.is_dir():
            return None

        candidates: list[str] = []
        hint = (foto_hint or "").strip()
        if hint:
            safe = _safe_basename(hint)
            if safe:
                candidates.append(safe)
        key = _normalize_no_empleado_key(no_empleado)
        if key:
            for ext in _FOTO_EXTENSIONS:
                candidates.append(f"{key}{ext}")

        seen: set[str] = set()
        for name in candidates:
            if name in seen:
                continue
            seen.add(name)
            path = (base / name).resolve()
            try:
                path.relative_to(base.resolve())
            except ValueError:
                continue
            if path.is_file():
                return path
        return None

    def read_foto_bytes(self, path: Path) -> tuple[bytes, str]:
        data = path.read_bytes()
        if not data:
            raise NotFoundError(entidad="Fotografía de empleado")
        ext = path.suffix.lower()
        media = _MIME_BY_EXT.get(ext, "image/jpeg")
        return data, media

    async def get_foto_for_empleado(
        self,
        empleado_id: int,
        current_user: Empleado,
    ) -> tuple[bytes, str]:
        empleado = await self.repo.get(empleado_id)
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=empleado_id)

        await self._usuarios._ensure_puede_ver_empleado(current_user, empleado_id)

        foto_path = self.resolve_foto_path(
            no_empleado=empleado.no_empleado,
            foto_hint=empleado.foto,
        )
        if foto_path is None:
            raise NotFoundError(entidad="Fotografía de empleado", id=empleado_id)

        return self.read_foto_bytes(foto_path)
