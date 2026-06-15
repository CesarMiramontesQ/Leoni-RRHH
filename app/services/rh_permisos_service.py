from fastapi import HTTPException, status

from app.core.config import settings
from app.core.rh_module_registry import (
    all_module_keys,
    catalog_for_api,
    effective_modules_for_display,
    empty_modulos_rh_config,
    has_personalized_modulos_rh,
    is_modulos_rh_enrolled,
    validate_modulos_rh_keys,
)
from app.models.empleados import Empleado
from app.repositories.rh_permisos_repository import RhPermisosRepository
from app.schemas.rh_permisos import (
    RhEmpleadoBusquedaItem,
    RhPermisosMeResponse,
    RhPermisosUpdate,
    RhUsuarioPermisosItem,
)


class RhPermisosService:
    def __init__(self, repo: RhPermisosRepository) -> None:
        self.repo = repo

    def _require_admin_permisos(self, current_user: Empleado) -> None:
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol != "rh":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo usuarios RH pueden administrar permisos de módulos.",
            )
        if not current_user.puede_administrar_permisos_rh:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para administrar accesos por módulo.",
            )

    def _to_item(self, emp: Empleado, current_user: Empleado) -> RhUsuarioPermisosItem:
        rol = emp.rol.nombre if emp.rol else "empleado"
        activo = emp.estado_id in settings.ESTADOS_ACTIVOS_IDS if emp.estado_id is not None else False
        return RhUsuarioPermisosItem(
            empleado_id=emp.empleado_id,
            no_empleado=emp.no_empleado,
            nombre=emp.nombre,
            email=emp.email,
            rol_nombre=rol,
            activo=activo,
            permisos_personalizados=has_personalized_modulos_rh(emp),
            puede_administrar_permisos_rh=bool(emp.puede_administrar_permisos_rh),
            modulos=effective_modules_for_display(emp),
            editable=emp.empleado_id != current_user.empleado_id,
        )

    def get_me(self, current_user: Empleado) -> RhPermisosMeResponse:
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        inscrito = is_modulos_rh_enrolled(current_user)
        modulos = effective_modules_for_display(current_user) if inscrito else {}
        # Pertenencia a la lista administrada: un RH removido (acceso_rh_removido)
        # sigue "inscrito" para denegar acceso, pero NO está en la lista.
        en_lista_permisos = (
            rol == "rh" and not getattr(current_user, "acceso_rh_removido", False)
        ) or bool(getattr(current_user, "inscrito_modulos_rh", False))
        return RhPermisosMeResponse(
            rol=rol,
            puede_administrar_permisos_rh=bool(current_user.puede_administrar_permisos_rh),
            modulos=modulos,
            inscrito=inscrito,
            en_lista_permisos=en_lista_permisos,
        )

    def list_modulos_catalog(self, current_user: Empleado) -> list[dict]:
        self._require_admin_permisos(current_user)
        return catalog_for_api()

    async def list_usuarios_permisos(
        self, current_user: Empleado
    ) -> list[RhUsuarioPermisosItem]:
        self._require_admin_permisos(current_user)
        empleados = await self.repo.list_empleados_gestionados()
        return [self._to_item(emp, current_user) for emp in empleados]

    async def buscar_empleados_disponibles(
        self, *, q: str, current_user: Empleado
    ) -> list[RhEmpleadoBusquedaItem]:
        self._require_admin_permisos(current_user)
        empleados = await self.repo.search_empleados_disponibles(q=q)
        items: list[RhEmpleadoBusquedaItem] = []
        for emp in empleados:
            rol = emp.rol.nombre if emp.rol else "empleado"
            items.append(
                RhEmpleadoBusquedaItem(
                    empleado_id=emp.empleado_id,
                    no_empleado=emp.no_empleado,
                    nombre=emp.nombre,
                    email=emp.email,
                    rol_nombre=rol,
                )
            )
        return items

    async def agregar_empleado_permisos(
        self, *, empleado_id: int, current_user: Empleado
    ) -> RhUsuarioPermisosItem:
        self._require_admin_permisos(current_user)

        target = await self.repo.get_by_empleado_id(empleado_id)
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Empleado no encontrado.",
            )

        rol = target.rol.nombre if target.rol else "empleado"

        if rol == "rh":
            # Un RH removido puede re-incluirse en la lista (sin tocar su rol);
            # arranca sin permisos hasta que se le otorguen módulos.
            if getattr(target, "acceso_rh_removido", False):
                target = await self.repo.set_acceso_rh_removido(
                    target, False, empty_modulos_rh_config()
                )
                return self._to_item(target, current_user)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El empleado ya está en la lista de permisos.",
            )

        if is_modulos_rh_enrolled(target):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El empleado ya está en la lista de permisos.",
            )

        # Inscribir a un usuario de otro rol sin alterar su rol: queda registrado
        # con accesos vacíos hasta que RH le otorgue módulos explícitamente.
        target = await self.repo.set_inscripcion(target, True, empty_modulos_rh_config())
        return self._to_item(target, current_user)

    async def update_usuario_permisos(
        self,
        *,
        empleado_id: int,
        body: RhPermisosUpdate,
        current_user: Empleado,
    ) -> RhUsuarioPermisosItem:
        self._require_admin_permisos(current_user)

        if empleado_id == current_user.empleado_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes modificar tus propios permisos de módulo.",
            )

        invalid = validate_modulos_rh_keys(body.modulos.keys())
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Claves de módulo inválidas: {invalid}",
            )

        target = await self.repo.get_by_empleado_id(empleado_id)
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Empleado no encontrado.",
            )

        rol = target.rol.nombre if target.rol else "empleado"
        # Para roles distintos a RH, guardar accesos mantiene su inscripción
        # explícita; RH no usa el flag (su inscripción deriva del rol).
        inscrito = True if rol != "rh" else None
        normalized = {key: bool(body.modulos.get(key, False)) for key in all_module_keys()}
        await self.repo.update_modulos_rh(target, normalized, inscrito=inscrito)
        reloaded = await self.repo.get_by_empleado_id(empleado_id)
        if reloaded is None:
            raise HTTPException(status_code=404, detail="Empleado no encontrado.")
        return self._to_item(reloaded, current_user)

    async def remove_usuario_permisos(
        self, *, empleado_id: int, current_user: Empleado
    ) -> None:
        """Quita a un usuario de la administración de permisos por módulo.

        Solo afecta lo gestionado por este módulo (inscripción + accesos): no
        toca el rol ni la cuenta. Los usuarios con rol RH no se pueden quitar
        porque su inscripción deriva del rol.
        """
        self._require_admin_permisos(current_user)

        if empleado_id == current_user.empleado_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes eliminarte de la administración de permisos.",
            )

        target = await self.repo.get_by_empleado_id(empleado_id)
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Empleado no encontrado.",
            )

        if getattr(target, "puede_administrar_permisos_rh", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes eliminar a un administrador de permisos.",
            )

        rol = target.rol.nombre if target.rol else "empleado"

        if rol == "rh":
            # No se cambia el rol: el usuario conserva RH (y su toggle), pero queda
            # sin acceso a módulos RH (vista empleado) y oculto de la lista.
            if getattr(target, "acceso_rh_removido", False):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="El usuario ya fue removido de la administración de permisos.",
                )
            await self.repo.set_acceso_rh_removido(target, True, empty_modulos_rh_config())
            return

        if not is_modulos_rh_enrolled(target):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El empleado no está inscrito en la administración de permisos.",
            )

        # Quita la inscripción y limpia los accesos otorgados; el rol no cambia.
        await self.repo.set_inscripcion(target, False, {})
