from fastapi import HTTPException, status

from app.core.rh_module_registry import (
    all_module_keys,
    catalog_for_api,
    effective_modules_for_display,
    empty_modulos_rh_config,
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
        return RhUsuarioPermisosItem(
            empleado_id=emp.empleado_id,
            no_empleado=emp.no_empleado,
            nombre=emp.nombre,
            email=emp.email,
            rol_nombre=rol,
            puede_administrar_permisos_rh=bool(emp.puede_administrar_permisos_rh),
            modulos=effective_modules_for_display(emp),
            editable=emp.empleado_id != current_user.empleado_id,
        )

    def get_me(self, current_user: Empleado) -> RhPermisosMeResponse:
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        inscrito = is_modulos_rh_enrolled(current_user)
        modulos = effective_modules_for_display(current_user) if inscrito else {}
        return RhPermisosMeResponse(
            rol=rol,
            puede_administrar_permisos_rh=bool(current_user.puede_administrar_permisos_rh),
            modulos=modulos,
            inscrito=inscrito,
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

        if is_modulos_rh_enrolled(target):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El empleado ya está en la lista de permisos.",
            )

        rol = target.rol.nombre if target.rol else "empleado"
        if rol == "rh":
            updated = target
        else:
            updated = await self.repo.update_modulos_rh(target, empty_modulos_rh_config())

        reloaded = await self.repo.get_by_empleado_id(updated.empleado_id)
        return self._to_item(reloaded or updated, current_user)

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

        if not is_modulos_rh_enrolled(target):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El empleado no está inscrito en permisos por módulo. Agrégalo primero.",
            )

        normalized = {key: bool(body.modulos.get(key, False)) for key in all_module_keys()}
        await self.repo.update_modulos_rh(target, normalized)
        reloaded = await self.repo.get_by_empleado_id(empleado_id)
        if reloaded is None:
            raise HTTPException(status_code=404, detail="Empleado no encontrado.")
        return self._to_item(reloaded, current_user)
