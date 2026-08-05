from fastapi import HTTPException, status

from app.core import vista_rol_cache
from app.core.rh_ui_mode import is_admin_user
from app.core.vista_rol_registry import (
    ROLES_CONFIGURABLES,
    all_vista_keys,
    catalogo_para_api,
    defaults_por_rol,
    is_rol_configurable,
    rol_configurable_para_modo,
    validate_roles,
    validate_vista_keys,
)
from app.models.empleados import Empleado
from app.repositories.vistas_rol_repository import VistasRolRepository
from app.schemas.vistas_rol import (
    VistaRolCatalogItem,
    VistaRolConfigResponse,
    VistaRolConfigUpdate,
    VistaRolMeResponse,
)
from app.utils.audit_logger import log_action


class VistasRolService:
    def __init__(self, repo: VistasRolRepository) -> None:
        self.repo = repo

    def _require_admin(self, current_user: Empleado) -> None:
        if not is_admin_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso de administrador.",
            )

    async def _config_actual(self) -> dict[str, dict[str, bool]]:
        """Matriz completa. Una vista sin fila cuenta como apagada."""
        config = {rol: {key: False for key in all_vista_keys()} for rol in ROLES_CONFIGURABLES}
        for rol_nombre, vista_key, habilitado in await self.repo.listar():
            if rol_nombre in config and vista_key in config[rol_nombre]:
                config[rol_nombre][vista_key] = habilitado
        return config

    def list_catalogo(self, current_user: Empleado) -> list[VistaRolCatalogItem]:
        self._require_admin(current_user)
        return [VistaRolCatalogItem(**item) for item in catalogo_para_api()]

    async def get_config(self, current_user: Empleado) -> VistaRolConfigResponse:
        self._require_admin(current_user)
        return VistaRolConfigResponse(
            roles=list(ROLES_CONFIGURABLES), config=await self._config_actual()
        )

    async def get_me(
        self, current_user: Empleado, rh_ui_mode: str | None = None
    ) -> VistaRolMeResponse:
        """Vistas del rol del usuario.

        El admin RH está exento **solo en Modo RH**: al simular empleado/líder/gerente con
        el toggle, se le aplica la configuración de ese rol para que vea exactamente lo que
        ve quien lo tiene. Se le envía además la matriz completa (`por_rol`) para que
        cambiar de modo no requiera otra petición.
        """
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        todas = {key: True for key in all_vista_keys()}

        if is_admin_user(current_user):
            config = await self._config_actual()
            rol_simulado = rol_configurable_para_modo(rh_ui_mode)
            if rol_simulado is None:
                return VistaRolMeResponse(
                    rol=rol, configurable=False, vistas=todas, por_rol=config
                )
            return VistaRolMeResponse(
                rol=rol_simulado,
                configurable=True,
                vistas=config[rol_simulado],
                por_rol=config,
            )

        if not is_rol_configurable(rol):
            return VistaRolMeResponse(rol=rol, configurable=False, vistas=todas)

        # A un inscrito en módulos RH se le mandan igualmente las vistas de su rol: las
        # necesita para su navegación en Modo base. Es el frontend quien decide cuándo
        # aplicarlas, porque el toggle Modo RH / Modo base del no-admin vive solo en el
        # navegador y nunca llega hasta aquí. En Modo RH mandan sus módulos, no esto.

        config = await self._config_actual()
        return VistaRolMeResponse(rol=rol, configurable=True, vistas=config[rol])

    async def update_config(
        self,
        body: VistaRolConfigUpdate,
        current_user: Empleado,
        ip_address: str | None = None,
    ) -> VistaRolConfigResponse:
        self._require_admin(current_user)

        roles_invalidos = validate_roles({c.rol for c in body.cambios})
        if roles_invalidos:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Rol(es) no configurable(s): {', '.join(sorted(roles_invalidos))}. "
                    f"Permitidos: {', '.join(ROLES_CONFIGURABLES)}."
                ),
            )
        claves_invalidas = validate_vista_keys({c.vista_key for c in body.cambios})
        if claves_invalidas:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vista(s) desconocida(s): {', '.join(sorted(claves_invalidas))}.",
            )

        rol_ids = await self.repo.roles_por_nombre(list(ROLES_CONFIGURABLES))
        faltantes = sorted({c.rol for c in body.cambios} - rol_ids.keys())
        if faltantes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rol(es) inexistente(s) en la base de datos: {', '.join(faltantes)}.",
            )

        antes = await self._config_actual()
        aplicados: dict[str, dict[str, bool]] = {}
        for cambio in body.cambios:
            if antes[cambio.rol][cambio.vista_key] == cambio.habilitado:
                continue
            await self.repo.upsert(
                rol_id=rol_ids[cambio.rol],
                vista_key=cambio.vista_key,
                habilitado=cambio.habilitado,
                actualizado_por_empleado_id=current_user.empleado_id,
            )
            aplicados.setdefault(cambio.rol, {})[cambio.vista_key] = cambio.habilitado

        if aplicados:
            await log_action(
                self.repo.db,
                accion="VISTAS_ROL_UPDATED",
                modulo="vistas_rol",
                usuario_id=current_user.empleado_id,
                datos_antes={
                    rol: {k: antes[rol][k] for k in vistas} for rol, vistas in aplicados.items()
                },
                datos_despues=aplicados,
                ip_address=ip_address,
            )
            # El caché es por proceso: aquí queda al día de inmediato; el resto de
            # workers lo relee al vencer su TTL.
            vista_rol_cache.invalidate()

        return VistaRolConfigResponse(
            roles=list(ROLES_CONFIGURABLES), config=await self._config_actual()
        )

    async def restaurar_defaults(
        self, current_user: Empleado, ip_address: str | None = None
    ) -> VistaRolConfigResponse:
        """Vuelve a la configuración inicial (el acceso que cada rol tenía de origen)."""
        self._require_admin(current_user)
        defaults = defaults_por_rol()
        cambios = VistaRolConfigUpdate(
            cambios=[
                {"rol": rol, "vista_key": key, "habilitado": valor}
                for rol, vistas in defaults.items()
                for key, valor in vistas.items()
            ]
        )
        return await self.update_config(cambios, current_user, ip_address=ip_address)
