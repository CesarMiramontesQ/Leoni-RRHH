from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.repositories.organigrama_repository import OrganigramaRepository
from app.schemas.organigrama import OrganigramaNodoResponse, OrganigramaResponse


class OrganigramaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = OrganigramaRepository(db)

    @staticmethod
    def _rol_nombre(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    def _require_rh_only(self, current_user: Empleado) -> None:
        if not user_has_module(current_user, "organigrama"):
            raise ForbiddenError(detail="No tienes acceso al módulo de organigrama")

    @staticmethod
    def _correo_preferente(empleado: Empleado) -> str | None:
        if empleado.email and empleado.email.strip():
            return empleado.email.strip()
        return None

    @staticmethod
    def _map_nivel_visual_por_texto(valor: str | None) -> str | None:
        if not valor:
            return None
        raw = valor.strip().lower()
        if not raw:
            return None
        if "direc" in raw:
            return "direccion"
        if "geren" in raw:
            return "gerencia"
        if "jef" in raw:
            return "jefaturas"
        if "oper" in raw:
            return "operacion"
        return None

    @classmethod
    def _nivel_visual_por_contexto(cls, empleado: Empleado, nivel_jerarquico: int) -> str:
        por_categoria = cls._map_nivel_visual_por_texto(
            empleado.categoria.descripcion if empleado.categoria else None
        ) or cls._map_nivel_visual_por_texto(
            empleado.categoria.nivel if empleado.categoria else None
        )
        if por_categoria:
            return por_categoria

        por_puesto = cls._map_nivel_visual_por_texto(
            empleado.puesto.descripcion if empleado.puesto else None
        )
        if por_puesto:
            return por_puesto

        if nivel_jerarquico <= 0:
            return "direccion"
        if nivel_jerarquico == 1:
            return "gerencia"
        if nivel_jerarquico == 2:
            return "jefaturas"
        return "operacion"

    @classmethod
    def _construir_nodo_base(cls, empleado: Empleado) -> OrganigramaNodoResponse:
        return OrganigramaNodoResponse(
            id=empleado.id,
            empleado_id=empleado.empleado_id,
            no_empleado=empleado.no_empleado,
            nombre_colaborador=empleado.nombre,
            nombre_puesto=empleado.puesto.descripcion if empleado.puesto else None,
            departamento=empleado.area.descripcion if empleado.area else None,
            correo=cls._correo_preferente(empleado),
            foto_url=empleado.foto,
            extension_telefono=None,
            parent_id=empleado.lider.id if empleado.lider else None,
            nivel_jerarquico=0,
            nivel_visual="operacion",
            activo=True,
            estado_empleado=empleado.estado.descripcion if empleado.estado else None,
            reportes_directos=0,
            created_at=empleado.created_at,
            updated_at=None,
            relacion_incompleta=False,
            children=[],
        )

    @staticmethod
    def _asignar_nivel_recursivo(
        nodo: OrganigramaNodoResponse,
        nivel: int,
        empleados_por_id: dict[int, Empleado],
    ) -> None:
        nodo.nivel_jerarquico = nivel
        nodo.nivel_visual = OrganigramaService._nivel_visual_por_contexto(
            empleados_por_id[nodo.id], nivel
        )
        nodo.reportes_directos = len(nodo.children)
        for child in nodo.children:
            OrganigramaService._asignar_nivel_recursivo(
                child,
                nivel + 1,
                empleados_por_id,
            )

    async def obtener_estructura(self, current_user: Empleado) -> OrganigramaResponse:
        self._require_rh_only(current_user)
        empleados = await self.repo.list_empleados_para_organigrama(
            estados_activos=settings.ESTADOS_ACTIVOS_IDS
        )

        if not empleados:
            return OrganigramaResponse(
                total_nodos=0,
                total_raices=0,
                total_relaciones_incompletas=0,
                generated_at=datetime.now(timezone.utc),
                roots=[],
            )

        nodos_por_id: dict[int, OrganigramaNodoResponse] = {}
        nodos_por_empleado_id: dict[int, OrganigramaNodoResponse] = {}
        empleados_por_id: dict[int, Empleado] = {}
        for empleado in empleados:
            nodo = self._construir_nodo_base(empleado)
            nodos_por_id[empleado.id] = nodo
            nodos_por_empleado_id[empleado.empleado_id] = nodo
            empleados_por_id[empleado.id] = empleado

        roots: list[OrganigramaNodoResponse] = []
        relaciones_incompletas = 0

        for empleado in empleados:
            nodo = nodos_por_id[empleado.id]
            lider_empleado_id = empleado.lider_id
            if lider_empleado_id is None:
                roots.append(nodo)
                continue

            parent = nodos_por_empleado_id.get(lider_empleado_id)
            if not parent:
                nodo.relacion_incompleta = True
                relaciones_incompletas += 1
                roots.append(nodo)
                continue

            parent.children.append(nodo)

        for root in roots:
            self._asignar_nivel_recursivo(root, 0, empleados_por_id)
        for nodo in nodos_por_id.values():
            nodo.children.sort(
                key=lambda child: (
                    child.nivel_jerarquico,
                    (child.nombre_colaborador or "").lower(),
                )
            )
        roots.sort(
            key=lambda node: (
                node.nivel_jerarquico,
                (node.nombre_colaborador or "").lower(),
            )
        )

        return OrganigramaResponse(
            total_nodos=len(nodos_por_id),
            total_raices=len(roots),
            total_relaciones_incompletas=relaciones_incompletas,
            generated_at=datetime.now(timezone.utc),
            roots=roots,
        )
