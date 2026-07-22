# app/services/metas_service.py
"""Logica de negocio del modulo Metas (OKR ligero).

Responsabilidades:
  - Ciclo de vida de `MetaCiclo`: borrador -> activo -> cerrado.
  - CRUD de `Meta` (individual/equipo) y sus `MetaResultadoClave`, con las
    validaciones cruzadas del spec (nivel/empleado_id/area_id/lider_id,
    `meta_padre_id`, ciclo activo).
  - Seguimiento: `registrar_checkin` (empleado o ajuste del jefe).
  - Cierre: `cerrar_meta` (calificacion 0-100 por el jefe) y `cerrar_ciclo`
    (congela metas de equipo pendientes y calcula cumplimiento).
  - Formulas de avance/cumplimiento (funciones puras + wrappers de service,
    ver seccion "Calculo" mas abajo).

El commit lo realiza la dependencia `get_db` al cierre del request; aqui solo
se usa flush() (via el repositorio), como el resto de services del proyecto.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, DomainValidationError, NotFoundError
from app.models.metas import Meta, MetaCheckin, MetaCiclo, MetaResultadoClave
from app.repositories.metas_repository import MetasRepository
from app.schemas.metas import (
    CheckinResponse,
    MetaCicloCreate,
    MetaCicloResponse,
    MetaCreate,
    MetaFiltros,
    MetaResponse,
    MetaUpdate,
    ResultadoClaveCreate,
    ResultadoClaveResponse,
    ResultadoClaveUpdate,
)

Numero = Decimal | int | float


# ══════════════════════════════════════════════════════════════════════════
# Calculo — funciones puras (exportables para test directo, sin BD)
# ══════════════════════════════════════════════════════════════════════════


def _clamp_round_pct(valor: float, ndigits: int = 0) -> float:
    """Clamp a [0, 100] y redondeo half-up (no half-even: 62.5 -> 63, no 62).

    Se usa para toda cifra "tipo porcentaje" del modulo (avance de RC/meta,
    cumplimiento ponderado) para que el resultado sea estable y documentado.
    """
    clamped = max(0.0, min(100.0, valor))
    quantum = Decimal(1).scaleb(-ndigits)
    return float(Decimal(str(clamped)).quantize(quantum, rounding=ROUND_HALF_UP))


def calcular_avance_rc(
    tipo_metrica: str,
    direccion: str,
    valor_inicial: Numero,
    valor_objetivo: Numero,
    valor_actual: Numero,
) -> float:
    """Avance % (0-100, clamp) de un resultado clave. Ver spec
    "Formula de avance y cumplimiento":

      - `booleano`: 100 si `valor_actual == valor_objetivo`, si no 0
        (direccion no aplica: el booleano no tiene "sentido" de avance).
      - `subir`: `(actual - inicial) / (objetivo - inicial)`.
      - `bajar`: `(inicial - actual) / (inicial - objetivo)`.
      - Borde documentado: denominador 0 (objetivo == inicial, tipos no
        booleanos) -> 100 si `actual` ya cumple el objetivo, si no 0.
    """
    ini = float(valor_inicial)
    obj = float(valor_objetivo)
    act = float(valor_actual)

    if tipo_metrica == "booleano":
        raw = 100.0 if act == obj else 0.0
    elif direccion == "subir":
        denom = obj - ini
        if denom == 0:
            raw = 100.0 if act >= obj else 0.0
        else:
            raw = (act - ini) / denom * 100.0
    elif direccion == "bajar":
        denom = ini - obj
        if denom == 0:
            raw = 100.0 if act <= obj else 0.0
        else:
            raw = (ini - act) / denom * 100.0
    else:
        raise ValueError(f"direccion invalida: {direccion!r}")

    return _clamp_round_pct(raw)


def _validar_rc_valores(tipo_metrica: str, valor_inicial: Numero, valor_objetivo: Numero) -> None:
    """RC con `valor_objetivo == valor_inicial` solo se permite si es
    `booleano` (donde ambos valores no importan para el avance) — ver spec
    "Ciclo de vida y validaciones"."""
    if tipo_metrica != "booleano" and Decimal(str(valor_objetivo)) == Decimal(str(valor_inicial)):
        raise DomainValidationError(
            "valor_objetivo debe ser distinto de valor_inicial (salvo tipo_metrica booleano)",
            field="valor_objetivo",
        )


class MetasService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = MetasRepository(db)

    # ══════════════════════════════════════════════════════════════════════
    # Calculo — wrappers de service (operan sobre objetos ya cargados)
    # ══════════════════════════════════════════════════════════════════════
    def avance_rc(self, rc: MetaResultadoClave) -> float:
        return calcular_avance_rc(
            rc.tipo_metrica, rc.direccion, rc.valor_inicial, rc.valor_objetivo, rc.valor_actual
        )

    def avance_meta(self, meta: Meta) -> float:
        """Promedio simple de los avances de sus resultados clave.

        Roll-up de meta de equipo (decision documentada en el spec): si la
        meta de equipo tiene resultados clave propios, esos mandan (se
        promedian igual que una meta individual); si no tiene, el avance es
        el promedio del avance de sus `submetas` (metas individuales
        enlazadas via `meta_padre_id`). Sin RC y sin submetas -> 0.
        """
        if meta.nivel == "equipo" and not meta.resultados_clave:
            submetas = list(meta.submetas or [])
            if not submetas:
                return 0.0
            return _clamp_round_pct(
                sum(self.avance_meta(sm) for sm in submetas) / len(submetas)
            )

        if not meta.resultados_clave:
            return 0.0
        return _clamp_round_pct(
            sum(self.avance_rc(rc) for rc in meta.resultados_clave) / len(meta.resultados_clave)
        )

    async def cumplimiento_empleado(self, ciclo_id: int, empleado_id: int) -> float:
        """Cumplimiento ponderado del empleado en el ciclo:
        `Σ(peso_i × calificacion_cierre_i) / Σ(peso_i)` sobre sus metas
        individuales ya cerradas (calificadas). Sin metas cerradas -> 0
        (borde documentado, evita division por cero)."""
        metas = await self.repo.list_metas_cerradas_empleado(ciclo_id, empleado_id)
        total_peso = sum(float(m.peso) for m in metas)
        if total_peso <= 0:
            return 0.0
        total_ponderado = sum(
            float(m.peso) * float(m.calificacion_cierre or 0) for m in metas
        )
        return _clamp_round_pct(total_ponderado / total_peso, ndigits=2)

    # ══════════════════════════════════════════════════════════════════════
    # Ciclo
    # ══════════════════════════════════════════════════════════════════════
    async def crear_ciclo(self, data: MetaCicloCreate) -> MetaCicloResponse:
        if data.fecha_fin <= data.fecha_inicio:
            raise DomainValidationError(
                "fecha_fin debe ser posterior a fecha_inicio", field="fecha_fin"
            )
        ciclo = MetaCiclo(
            nombre=data.nombre,
            descripcion=data.descripcion,
            fecha_inicio=data.fecha_inicio,
            fecha_fin=data.fecha_fin,
            estado="borrador",
            creado_por_id=data.creado_por_id,
            metas=[],
        )
        self.db.add(ciclo)
        await self.db.flush()
        await self.db.refresh(ciclo)
        return self._ciclo_to_response(ciclo)

    async def activar_ciclo(self, ciclo_id: int) -> MetaCicloResponse:
        ciclo = await self.repo.get_ciclo(ciclo_id)
        if not ciclo:
            raise NotFoundError("MetaCiclo", ciclo_id)
        if ciclo.estado != "borrador":
            raise ConflictError("Solo se puede activar un ciclo en borrador")
        ciclo.estado = "activo"
        await self.db.flush()
        await self.db.refresh(ciclo)
        return self._ciclo_to_response(ciclo)

    async def cerrar_ciclo(self, ciclo_id: int) -> MetaCicloResponse:
        """activo -> cerrado: congela el ciclo y calcula cumplimiento.

        Decision documentada (spec: "exige calificacion previa o permite
        calificar al cierre"): se exige calificacion previa para METAS
        INDIVIDUALES — deben cerrarse (via `cerrar_meta`) antes de cerrar el
        ciclo, porque `cumplimiento_empleado` solo tiene sentido con
        calificaciones ya puestas por el jefe (si se auto-cerraran sin
        calificar, quedarian con `calificacion_cierre=None` y distorsionarian
        la ponderacion). Las metas de EQUIPO, en cambio, no alimentan
        `cumplimiento_empleado` directamente, asi que se congelan
        automaticamente (pasan a "cerrada" sin exigir calificacion previa).
        """
        ciclo = await self.repo.get_ciclo(ciclo_id)
        if not ciclo:
            raise NotFoundError("MetaCiclo", ciclo_id)
        if ciclo.estado != "activo":
            raise ConflictError("Solo se puede cerrar un ciclo activo")

        pendientes = await self.repo.list_metas_individuales_no_cerradas(ciclo_id)
        if pendientes:
            ids = ", ".join(str(m.id) for m in pendientes)
            raise ConflictError(
                f"No se puede cerrar el ciclo: {len(pendientes)} meta(s) individual(es) "
                f"sin calificar (usar cerrar_meta primero): {ids}"
            )

        metas_equipo = await self.repo.list_metas_equipo_no_cerradas(ciclo_id)
        for meta_equipo in metas_equipo:
            meta_equipo.estado = "cerrada"

        ciclo.estado = "cerrado"
        await self.db.flush()
        await self.db.refresh(ciclo)
        return self._ciclo_to_response(ciclo)

    async def list_ciclos(self, estado: Optional[str] = None) -> list[MetaCicloResponse]:
        ciclos = await self.repo.list_ciclos(estado=estado)
        return [self._ciclo_to_response(c) for c in ciclos]

    # ══════════════════════════════════════════════════════════════════════
    # Meta
    # ══════════════════════════════════════════════════════════════════════
    async def crear_meta(self, data: MetaCreate) -> MetaResponse:
        ciclo = await self.repo.get_ciclo(data.ciclo_id)
        if not ciclo:
            raise NotFoundError("MetaCiclo", data.ciclo_id)
        if ciclo.estado != "activo":
            raise ConflictError("Solo se pueden asignar metas en un ciclo activo")

        if data.nivel == "individual":
            if data.empleado_id is None:
                raise DomainValidationError(
                    "empleado_id es obligatorio para una meta individual",
                    field="empleado_id",
                )
        else:  # equipo
            if data.area_id is None or data.lider_id is None:
                raise DomainValidationError(
                    "area_id y lider_id son obligatorios para una meta de equipo",
                    field="area_id",
                )

        if data.meta_padre_id is not None:
            await self._validar_meta_padre(data.meta_padre_id, data.ciclo_id)

        for rc_data in data.resultados_clave:
            _validar_rc_valores(rc_data.tipo_metrica, rc_data.valor_inicial, rc_data.valor_objetivo)

        meta = Meta(
            ciclo_id=data.ciclo_id,
            nivel=data.nivel,
            empleado_id=data.empleado_id,
            area_id=data.area_id,
            lider_id=data.lider_id,
            titulo=data.titulo,
            descripcion=data.descripcion,
            peso=data.peso,
            estado="asignada",
            meta_padre_id=data.meta_padre_id,
            asignada_por_id=data.asignada_por_id,
            resultados_clave=[],
        )
        self.db.add(meta)
        for orden, rc_data in enumerate(data.resultados_clave, start=1):
            meta.resultados_clave.append(self._nuevo_rc_obj(rc_data, orden_defecto=orden))
        await self.db.flush()
        return await self.get_meta(meta.id)

    async def _validar_meta_padre(self, meta_padre_id: int, ciclo_id: int) -> Meta:
        meta_padre = await self.repo.get_meta(meta_padre_id)
        if not meta_padre:
            raise NotFoundError("Meta", meta_padre_id)
        if meta_padre.nivel != "equipo":
            raise DomainValidationError(
                "meta_padre_id debe apuntar a una meta de nivel equipo",
                field="meta_padre_id",
            )
        if meta_padre.ciclo_id != ciclo_id:
            raise DomainValidationError(
                "meta_padre_id debe pertenecer al mismo ciclo",
                field="meta_padre_id",
            )
        return meta_padre

    @staticmethod
    def _nuevo_rc_obj(data: ResultadoClaveCreate, orden_defecto: int) -> MetaResultadoClave:
        return MetaResultadoClave(
            orden=data.orden if data.orden is not None else orden_defecto,
            titulo=data.titulo,
            tipo_metrica=data.tipo_metrica,
            unidad=data.unidad,
            direccion=data.direccion,
            valor_inicial=data.valor_inicial,
            valor_objetivo=data.valor_objetivo,
            valor_actual=data.valor_actual if data.valor_actual is not None else data.valor_inicial,
            checkins=[],
        )

    async def get_meta(self, meta_id: int) -> MetaResponse:
        meta = await self.repo.get_meta(meta_id)
        if not meta:
            raise NotFoundError("Meta", meta_id)
        return self._meta_to_response(meta)

    async def list_metas(self, filtros: MetaFiltros) -> list[MetaResponse]:
        metas = await self.repo.list_metas(
            ciclo_id=filtros.ciclo_id, empleado_id=filtros.empleado_id, nivel=filtros.nivel
        )
        return [self._meta_to_response(m) for m in metas]

    async def actualizar_meta(self, meta_id: int, data: MetaUpdate) -> MetaResponse:
        meta = await self._get_meta_ciclo_activo(meta_id)
        if meta.estado == "cerrada":
            raise ConflictError("No se puede editar una meta cerrada")

        payload = data.model_dump(exclude_unset=True)

        if "empleado_id" in payload and meta.nivel != "individual":
            raise DomainValidationError(
                "empleado_id solo aplica a metas de nivel individual", field="empleado_id"
            )
        if ("area_id" in payload or "lider_id" in payload) and meta.nivel != "equipo":
            raise DomainValidationError(
                "area_id/lider_id solo aplican a metas de nivel equipo", field="area_id"
            )
        if "meta_padre_id" in payload and payload["meta_padre_id"] is not None:
            await self._validar_meta_padre(payload["meta_padre_id"], meta.ciclo_id)

        for key, value in payload.items():
            setattr(meta, key, value)
        await self.db.flush()
        return await self.get_meta(meta.id)

    async def eliminar_meta(self, meta_id: int) -> None:
        meta = await self._get_meta_ciclo_activo(meta_id)
        tiene_checkins = any(rc.checkins for rc in meta.resultados_clave)
        if tiene_checkins:
            raise ConflictError("No se puede eliminar una meta con check-ins registrados")
        await self.db.delete(meta)
        await self.db.flush()

    async def cerrar_meta(
        self,
        meta_id: int,
        calificacion: Numero,
        comentario: Optional[str] = None,
        actor_id: Optional[int] = None,
    ) -> MetaResponse:
        """Califica y cierra una meta (asignada/en_progreso -> cerrada).

        `actor_id` se acepta para simetria con el futuro endpoint (Tarea 3
        valida ahi permisos/scoping de equipo); esta capa no lo audita
        todavia — no hay campo de auditoria en el modelo de Tarea 1.
        """
        meta = await self._get_meta_ciclo_activo(meta_id)
        if meta.estado == "cerrada":
            raise ConflictError("La meta ya esta cerrada")

        calificacion_dec = Decimal(str(calificacion))
        if not (Decimal("0") <= calificacion_dec <= Decimal("100")):
            raise DomainValidationError(
                "calificacion debe estar entre 0 y 100", field="calificacion"
            )

        meta.calificacion_cierre = calificacion_dec
        meta.comentario_cierre = comentario
        meta.estado = "cerrada"
        await self.db.flush()
        return await self.get_meta(meta.id)

    async def _get_meta_ciclo_activo(self, meta_id: int) -> Meta:
        meta = await self.repo.get_meta(meta_id)
        if not meta:
            raise NotFoundError("Meta", meta_id)
        if meta.ciclo.estado != "activo":
            raise ConflictError(
                "Solo se pueden modificar metas de un ciclo activo"
            )
        return meta

    # ── Self-service (empleado) ───────────────────────────────────────────
    async def list_mis_metas(
        self, empleado_id: int, ciclo_id: Optional[int] = None
    ) -> list[MetaResponse]:
        metas = await self.repo.list_metas(
            ciclo_id=ciclo_id, empleado_id=empleado_id, nivel="individual"
        )
        return [self._meta_to_response(m) for m in metas]

    async def get_mi_meta(self, meta_id: int, empleado_id: int) -> MetaResponse:
        meta = await self.repo.get_meta(meta_id)
        if not meta or meta.empleado_id != empleado_id:
            raise NotFoundError("Meta", meta_id)
        return self._meta_to_response(meta)

    # ══════════════════════════════════════════════════════════════════════
    # Resultado clave
    # ══════════════════════════════════════════════════════════════════════
    async def agregar_rc(self, meta_id: int, data: ResultadoClaveCreate) -> ResultadoClaveResponse:
        meta = await self._get_meta_ciclo_activo(meta_id)
        if meta.estado == "cerrada":
            raise ConflictError("No se pueden agregar resultados clave a una meta cerrada")
        _validar_rc_valores(data.tipo_metrica, data.valor_inicial, data.valor_objetivo)

        rc = self._nuevo_rc_obj(data, orden_defecto=len(meta.resultados_clave) + 1)
        rc.meta_id = meta_id
        self.db.add(rc)
        await self.db.flush()
        await self.db.refresh(rc)
        return self._rc_to_response(rc)

    async def actualizar_rc(self, rc_id: int, data: ResultadoClaveUpdate) -> ResultadoClaveResponse:
        rc = await self._get_rc_editable(rc_id)
        payload = data.model_dump(exclude_unset=True)
        if "valor_objetivo" in payload:
            _validar_rc_valores(rc.tipo_metrica, rc.valor_inicial, payload["valor_objetivo"])
        for key, value in payload.items():
            setattr(rc, key, value)
        await self.db.flush()
        return self._rc_to_response(rc)

    async def eliminar_rc(self, rc_id: int) -> None:
        rc = await self._get_rc_editable(rc_id)
        if rc.checkins:
            raise ConflictError(
                "No se puede eliminar un resultado clave con check-ins registrados"
            )
        await self.db.delete(rc)
        await self.db.flush()

    async def _get_rc_editable(self, rc_id: int) -> MetaResultadoClave:
        rc = await self.repo.get_rc(rc_id)
        if not rc:
            raise NotFoundError("MetaResultadoClave", rc_id)
        if rc.meta.ciclo.estado != "activo":
            raise ConflictError(
                "Solo se pueden modificar resultados clave de un ciclo activo"
            )
        if rc.meta.estado == "cerrada":
            raise ConflictError(
                "No se pueden modificar resultados clave de una meta cerrada"
            )
        return rc

    # ── Check-in ───────────────────────────────────────────────────────────
    async def registrar_checkin(
        self,
        rc_id: int,
        autor_id: int,
        valor: Numero,
        nota: Optional[str] = None,
        es_ajuste_jefe: bool = False,
    ) -> CheckinResponse:
        """Registra un check-in inmutable y actualiza `valor_actual` del RC.

        Primer check-in: si la meta esta "asignada" pasa a "en_progreso"
        (solo se evalua el estado actual, no un conteo de check-ins previos:
        una meta solo esta en "asignada" antes de su primer check-in por
        diseno del ciclo de vida, ver spec)."""
        rc = await self._get_rc_editable(rc_id)
        meta = rc.meta

        checkin = MetaCheckin(
            autor_id=autor_id,
            valor_registrado=Decimal(str(valor)),
            nota=nota,
            es_ajuste_jefe=es_ajuste_jefe,
        )
        # Se agrega via la relacion (no seteando resultado_clave_id a mano):
        # asi la coleccion `rc.checkins` -ya cargada en memoria por el
        # selectinload de `_get_rc_editable`- queda sincronizada. Si solo se
        # asignara la FK, `rc.checkins` seguiria "vacia" en memoria para el
        # resto de la sesion (p. ej. el guard de `eliminar_meta`/`eliminar_rc`
        # que verifica `rc.checkins` no veria este check-in).
        rc.checkins.append(checkin)
        rc.valor_actual = Decimal(str(valor))
        if meta.estado == "asignada":
            meta.estado = "en_progreso"

        await self.db.flush()
        await self.db.refresh(checkin)
        return CheckinResponse(
            id=checkin.id,
            resultado_clave_id=checkin.resultado_clave_id,
            autor_id=checkin.autor_id,
            valor_registrado=checkin.valor_registrado,
            nota=checkin.nota,
            es_ajuste_jefe=checkin.es_ajuste_jefe,
            created_at=checkin.created_at,
            avance_resultante=self.avance_rc(rc),
        )

    # ══════════════════════════════════════════════════════════════════════
    # Serializacion
    # ══════════════════════════════════════════════════════════════════════
    def _ciclo_to_response(self, ciclo: MetaCiclo) -> MetaCicloResponse:
        return MetaCicloResponse.model_validate(ciclo)

    def _rc_to_response(self, rc: MetaResultadoClave) -> ResultadoClaveResponse:
        data = ResultadoClaveResponse.model_validate(rc)
        data.avance = self.avance_rc(rc)
        return data

    def _meta_to_response(self, meta: Meta) -> MetaResponse:
        data = MetaResponse.model_validate(meta)
        data.avance = self.avance_meta(meta)
        data.resultados_clave = [self._rc_to_response(rc) for rc in meta.resultados_clave]
        return data
