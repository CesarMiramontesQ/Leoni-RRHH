# app/services/ciclo_desempeno_service.py
"""Logica de negocio del modulo Ciclo de Desempeno (orquestador).

Combina dos senales existentes en una calificacion de desempeno ponderada
por empleado, y agrega una captura manual de potencial para ubicar a cada
empleado en la matriz 9-Box:

  - Cumplimiento de metas individuales (`MetasService.cumplimiento_empleado`,
    via `levelup_meta_ciclo` vinculado).
  - Calificacion de competencias 360 (fila resumen `Eval360Resultado` con
    `competencia_id IS NULL`, `calificacion_general` en la escala Likert de
    la campana vinculada `levelup_eval360_campana`).

Este servicio NO lee esas tablas por SQL directo: usa `MetasRepository`
(cumplimiento/metas cerradas/universo de metas individuales) y
`Evaluacion360Repository` (participantes/resultado global/escala), mas
`Evaluacion360Service.get_or_create_config()` (metodo publico) solo como
fallback de escala global cuando la campana no tiene una propia -- replica
el mismo patron de `Evaluacion360Service._escala_de_campana` en vez de
invocar ese metodo privado de otro service.

Ciclo de vida: borrador -> activo -> cerrado.
  - Activar materializa `CicloDesempenoResultado` (filas vacias) para el
    universo = empleados con meta individual en el meta_ciclo vinculado
    UNION participantes de la campana 360 vinculada.
  - Mientras el ciclo esta "activo", las lecturas (`resultados_ciclo`,
    `construir_9box`) CALCULAN EN VIVO leyendo las senales fuente (los
    resultados 360 no se congelan, se recalculan en cada lectura -- ver
    docstring de `evaluacion360_service`). El unico dato que se persiste en
    vivo es `potencial` (captura manual, no derivable de una fuente).
  - Cerrar congela ("snapshotea") calificacion/bandas/segmento de cada
    resultado -- de ahi en adelante las lecturas usan el snapshot, estable
    aunque las fuentes (metas/360) cambien despues.

Override de cierre (nota de revision Tarea 2): viaja en el BODY del
endpoint (`CicloDesempenoCerrarRequest.forzar`), se recibe aqui como el
parametro `forzar` de `cerrar_ciclo` -- NO se lee de `CicloDesempeno.config`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Union

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
)
from app.models.ciclo_desempeno import CICLO_DESEMPENO_BANDAS, CicloDesempeno
from app.models.evaluacion360 import Eval360Campana, Eval360Escala
from app.repositories.ciclo_desempeno_repository import CicloDesempenoRepository
from app.repositories.evaluacion360_repository import Evaluacion360Repository
from app.repositories.metas_repository import MetasRepository
from app.schemas.ciclo_desempeno import (
    BandaAjusteItem,
    CeldaResponse,
    CicloDesempenoCreate,
    CicloDesempenoResponse,
    CicloDesempenoResultadoResponse,
    CicloDesempenoUpdate,
    DistribucionBanda,
    DistribucionResponse,
    MisResultadoResponse,
    NueveBoxEmpleadoItem,
    NueveBoxResponse,
    PotencialUpdateItem,
)
from app.services.evaluacion360_service import Evaluacion360Service
from app.services.metas_service import MetasService

Numero = Union[Decimal, int, float]


# ══════════════════════════════════════════════════════════════════════════
# Calculo — funciones puras (exportables para test directo, sin BD)
# ══════════════════════════════════════════════════════════════════════════


def normalizar_360(
    calificacion: Optional[Numero], vmin: Numero, vmax: Numero
) -> Optional[float]:
    """Normaliza una calificacion 360 (escala Likert `vmin`-`vmax`) a 0-100.

    `calificacion is None` (sin resultado 360 / campana no vinculada) ->
    senal AUSENTE (`None`). Escala degenerada (`vmax <= vmin`) tambien se
    trata como ausente (evita division por cero; no deberia ocurrir con
    escalas validas, pero es un borde defensivo)."""
    if calificacion is None:
        return None
    vmin_f = float(vmin)
    vmax_f = float(vmax)
    if vmax_f <= vmin_f:
        return None
    frac = (float(calificacion) - vmin_f) / (vmax_f - vmin_f)
    frac = max(0.0, min(1.0, frac))
    return round(frac * 100.0, 2)


def combinar_score(
    cumplimiento_metas: Optional[Numero],
    calificacion_360_norm: Optional[Numero],
    indice_historial: Optional[Numero],
    peso_metas: Numero,
    peso_competencias: Numero,
    peso_historial: Numero,
) -> tuple[Optional[float], Optional[float], Optional[float], Optional[float]]:
    """Combina hasta tres senales (metas, 360 normalizada, historial objetivo),
    todas 0-100 y en la misma direccion (mayor = mejor), ponderadas por sus
    pesos configurados. `None` en una senal = AUSENTE (distinto de un `0` real,
    que si cuenta).

    Una senal CUENTA si su valor no es None y su peso configurado es > 0.
      - score = suma(peso_i * valor_i) / suma(peso_i) sobre las que cuentan.
      - peso efectivo: si TODAS las senales con peso configurado > 0 estan
        presentes, cada efectivo es su peso configurado tal cual; si falta
        alguna, los pesos de las presentes se re-escalan proporcionalmente para
        sumar 100 (reproduce el comportamiento anterior de 2 senales: una sola
        presente -> 100). Una senal que no cuenta -> efectivo 0.
      - ninguna cuenta -> (None, None, None, None).

    Con `peso_historial=0` el resultado (score, pm_ef, pc_ef) es identico a la
    version anterior de dos senales y ph_ef = 0.
    """
    senales = [
        (cumplimiento_metas, float(peso_metas)),
        (calificacion_360_norm, float(peso_competencias)),
        (indice_historial, float(peso_historial)),
    ]
    cuentan = [(v, p) for (v, p) in senales if v is not None and p > 0]
    if not cuentan:
        return None, None, None, None

    suma_pesos = sum(p for _v, p in cuentan)
    score = round(sum(p * float(v) for v, p in cuentan) / suma_pesos, 2)

    # Todas las senales configuradas (peso > 0) presentes?
    configuradas = [(v, p) for (v, p) in senales if p > 0]
    todas_presentes = all(v is not None for v, _p in configuradas)

    efectivos: list[float] = []
    for (v, p) in senales:
        if v is not None and p > 0:
            efectivos.append(p if todas_presentes else round(p * 100.0 / suma_pesos, 2))
        else:
            efectivos.append(0.0)
    return score, efectivos[0], efectivos[1], efectivos[2]


def banda(valor: Numero, umbral_medio: Numero, umbral_alto: Numero) -> str:
    """Banda de un valor 0-100: `bajo` si < `umbral_medio`, `medio` si <
    `umbral_alto`, si no `alto`. Aplica igual a desempeno y potencial."""
    v = float(valor)
    um = float(umbral_medio)
    ua = float(umbral_alto)
    if v < um:
        return "bajo"
    if v < ua:
        return "medio"
    return "alto"


DISTRIBUCION_OBJETIVO_DEFAULT: dict[str, float] = {"alto": 20.0, "medio": 70.0, "bajo": 10.0}


def banda_efectiva(
    banda_calculada: Optional[str], banda_ajustada: Optional[str]
) -> Optional[str]:
    """Banda oficial de desempeno: la ajustada (override RH) si existe, si no
    la calculada. `None` en ambas => sin banda (senal ausente)."""
    return banda_ajustada or banda_calculada


def distribucion_bandas(bandas: list[Optional[str]]) -> dict:
    """Cuenta bandas `bajo`/`medio`/`alto` (ignora `None`) y calcula el
    porcentaje de cada una sobre el total de bandas no nulas. `total == 0`
    => todos los porcentajes en `0.0`."""
    conteo = {"bajo": 0, "medio": 0, "alto": 0}
    for b in bandas:
        if b in conteo:
            conteo[b] += 1
    total = conteo["bajo"] + conteo["medio"] + conteo["alto"]
    if total == 0:
        pct = {"bajo": 0.0, "medio": 0.0, "alto": 0.0}
    else:
        pct = {k: round(v * 100.0 / total, 2) for k, v in conteo.items()}
    return {**conteo, "total": total, "pct": pct}


def _dec(value: Optional[float]) -> Optional[Decimal]:
    """Convierte un `float` calculado a `Decimal` (2 decimales) para los
    campos `Optional[Decimal]` de los schemas de respuesta -- evita el
    ruido de representacion binaria de `Decimal(float)` directo."""
    if value is None:
        return None
    return Decimal(str(round(float(value), 2)))


class CicloDesempenoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CicloDesempenoRepository(db)
        self.metas_repo = MetasRepository(db)
        self.metas_service = MetasService(db)
        self.eval360_repo = Evaluacion360Repository(db)
        self.eval360_service = Evaluacion360Service(db)

    # ══════════════════════════════════════════════════════════════════════
    # Ciclo
    # ══════════════════════════════════════════════════════════════════════
    async def crear_ciclo(
        self, data: CicloDesempenoCreate, creado_por_id: Optional[int] = None
    ) -> CicloDesempenoResponse:
        ciclo = CicloDesempeno(
            nombre=data.nombre,
            descripcion=data.descripcion,
            fecha_inicio=data.fecha_inicio,
            fecha_fin=data.fecha_fin,
            estado="borrador",
            meta_ciclo_id=data.meta_ciclo_id,
            eval360_campana_id=data.eval360_campana_id,
            peso_metas=data.peso_metas,
            peso_competencias=data.peso_competencias,
            umbral_medio=data.umbral_medio,
            umbral_alto=data.umbral_alto,
            config=data.config,
            creado_por_id=creado_por_id,
        )
        ciclo = await self.repo.create_ciclo(ciclo)
        return await self._ciclo_a_response(ciclo)

    async def get_ciclo(self, ciclo_id: int) -> CicloDesempenoResponse:
        ciclo = await self._get_ciclo_o_404(ciclo_id)
        return await self._ciclo_a_response(ciclo)

    async def list_ciclos(self, estado: Optional[str] = None) -> list[CicloDesempenoResponse]:
        ciclos = await self.repo.list_ciclos(estado=estado)
        return [await self._ciclo_a_response(c) for c in ciclos]

    async def actualizar_ciclo(
        self, ciclo_id: int, data: CicloDesempenoUpdate
    ) -> CicloDesempenoResponse:
        """Solo permitido en `borrador`. Los validadores cruzados de
        `CicloDesempenoUpdate` solo corren cuando AMBOS campos de un par
        vienen en la misma peticion; aqui se revalida el resultado final
        (ciclo ya mutado) para cubrir el caso "un update cambia solo un lado
        del par y deja el otro inconsistente" (ej. solo `peso_metas` sin
        tocar `peso_competencias`)."""
        ciclo = await self._get_ciclo_o_404(ciclo_id)
        if ciclo.estado != "borrador":
            raise ConflictError("Solo se puede editar un ciclo en borrador")

        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(ciclo, key, value)

        if (
            ciclo.fecha_inicio is not None
            and ciclo.fecha_fin is not None
            and ciclo.fecha_fin < ciclo.fecha_inicio
        ):
            raise DomainValidationError(
                "fecha_fin debe ser >= fecha_inicio", field="fecha_fin"
            )
        if (ciclo.peso_metas + ciclo.peso_competencias) <= 0:
            raise DomainValidationError(
                "peso_metas + peso_competencias debe ser > 0", field="peso_metas"
            )
        if not (0 < ciclo.umbral_medio < ciclo.umbral_alto < 100):
            raise DomainValidationError(
                "umbrales invalidos: se requiere 0 < umbral_medio < umbral_alto < 100",
                field="umbral_medio",
            )

        await self.repo.update_ciclo(ciclo)
        return await self._ciclo_a_response(ciclo)

    async def activar_ciclo(self, ciclo_id: int) -> CicloDesempenoResponse:
        """borrador -> activo. Valida periodo/pesos/al menos una senal
        vinculada, y materializa `CicloDesempenoResultado` (filas vacias)
        para el universo = empleados con meta individual en el meta_ciclo
        vinculado UNION participantes de la campana 360 vinculada.
        Idempotente (UNIQUE ciclo_id+empleado_id en el repo)."""
        ciclo = await self._get_ciclo_o_404(ciclo_id)
        if ciclo.estado != "borrador":
            raise ConflictError("Solo se puede activar un ciclo en borrador")
        if ciclo.fecha_inicio is None or ciclo.fecha_fin is None:
            raise DomainValidationError(
                "El ciclo requiere fecha_inicio y fecha_fin para activarse",
                field="fecha_inicio",
            )
        if (ciclo.peso_metas + ciclo.peso_competencias) <= 0:
            raise DomainValidationError(
                "peso_metas + peso_competencias debe ser > 0", field="peso_metas"
            )
        if ciclo.meta_ciclo_id is None and ciclo.eval360_campana_id is None:
            raise DomainValidationError(
                "El ciclo requiere al menos una senal vinculada "
                "(meta_ciclo_id o eval360_campana_id)",
                field="meta_ciclo_id",
            )

        universo: set[int] = set()
        if ciclo.meta_ciclo_id is not None:
            metas = await self.metas_repo.list_metas(
                ciclo_id=ciclo.meta_ciclo_id, nivel="individual"
            )
            universo |= {m.empleado_id for m in metas if m.empleado_id is not None}
        if ciclo.eval360_campana_id is not None:
            participantes = await self.eval360_repo.list_participantes(
                ciclo.eval360_campana_id
            )
            universo |= {p.empleado_id for p in participantes}

        await self.repo.bulk_create_resultados(ciclo.id, sorted(universo))
        ciclo.estado = "activo"
        await self.repo.update_ciclo(ciclo)
        return await self._ciclo_a_response(ciclo)

    async def cerrar_ciclo(
        self, ciclo_id: int, forzar: bool = False
    ) -> CicloDesempenoResponse:
        """activo -> cerrado. Exige que las fuentes esten estables (meta_ciclo
        vinculado en estado "cerrado"; campana 360 vinculada en
        "finalizada"/"cerrada") salvo `forzar=True` (override puntual, viaja
        en el body via `CicloDesempenoCerrarRequest.forzar`). Congela
        (snapshotea) cada `CicloDesempenoResultado`: lee las senales fuente
        EN ESE MOMENTO, calcula score/bandas/segmento y persiste."""
        ciclo = await self._get_ciclo_o_404(ciclo_id)
        if ciclo.estado != "activo":
            raise ConflictError("Solo se puede cerrar un ciclo activo")

        if not forzar:
            if ciclo.meta_ciclo_id is not None:
                meta_ciclo = await self.metas_repo.get_ciclo(ciclo.meta_ciclo_id)
                if meta_ciclo is not None and meta_ciclo.estado != "cerrado":
                    raise DomainValidationError(
                        "El ciclo de metas vinculado no esta cerrado (snapshot "
                        "inestable); usa forzar=true para cerrar de todas formas",
                        field="meta_ciclo_id",
                    )
            if ciclo.eval360_campana_id is not None:
                campana = await self.eval360_repo.get_campana(ciclo.eval360_campana_id)
                if campana is not None and campana.estado not in ("finalizada", "cerrada"):
                    raise DomainValidationError(
                        "La campana 360 vinculada no esta finalizada/cerrada "
                        "(snapshot inestable); usa forzar=true para cerrar de "
                        "todas formas",
                        field="eval360_campana_id",
                    )

        campana, participante_by_empleado, escala = await self._contexto_senales(ciclo)
        ahora = datetime.now(timezone.utc)
        for resultado in ciclo.resultados:
            datos = await self._calcular_resultado_vivo(
                ciclo, resultado.empleado_id, participante_by_empleado, escala
            )
            banda_potencial = (
                banda(resultado.potencial, ciclo.umbral_medio, ciclo.umbral_alto)
                if resultado.potencial is not None
                else None
            )
            banda_efe = banda_efectiva(datos["banda_desempeno"], resultado.banda_desempeno_ajustada)
            segmento = (
                f"{banda_efe}_{banda_potencial}"
                if banda_efe is not None and banda_potencial is not None
                else None
            )
            await self.repo.upsert_resultado(
                ciclo.id,
                resultado.empleado_id,
                cumplimiento_metas=_dec(datos["cumplimiento_metas"]),
                calificacion_360_raw=_dec(datos["calificacion_360_raw"]),
                calificacion_360_norm=_dec(datos["calificacion_360_norm"]),
                escala_min=_dec(datos["escala_min"]),
                escala_max=_dec(datos["escala_max"]),
                calificacion_desempeno=_dec(datos["calificacion_desempeno"]),
                peso_metas_efectivo=_dec(datos["peso_metas_efectivo"]),
                peso_competencias_efectivo=_dec(datos["peso_competencias_efectivo"]),
                banda_desempeno=banda_efe,
                banda_potencial=banda_potencial,
                segmento_9box=segmento,
                snapshot_at=ahora,
            )

        ciclo.estado = "cerrado"
        await self.repo.update_ciclo(ciclo)
        return await self._ciclo_a_response(ciclo)

    # ══════════════════════════════════════════════════════════════════════
    # Potencial (captura manual)
    # ══════════════════════════════════════════════════════════════════════
    async def set_potencial(
        self,
        ciclo_id: int,
        items: list[PotencialUpdateItem],
        current_user_id: int,
        empleado_ids_scope: Optional[set[int]] = None,
    ) -> list[CicloDesempenoResultadoResponse]:
        """Escribe `potencial` + auditoria (`potencial_capturado_por_id/at`)
        y recalcula `banda_potencial`/`segmento_9box` EN VIVO (usa la
        calificacion de desempeno calculada en ese instante para armar el
        segmento; el ciclo debe estar `activo` -- en `cerrado` el snapshot ya
        esta congelado, `ConflictError` 409). `empleado_ids_scope`, si se
        pasa (scope de equipo resuelto por el router), rechaza con
        `ForbiddenError` cualquier item fuera de ese conjunto."""
        ciclo = await self._get_ciclo_o_404(ciclo_id)
        if ciclo.estado != "activo":
            raise ConflictError("Solo se puede capturar potencial en un ciclo activo")

        campana, participante_by_empleado, escala = await self._contexto_senales(ciclo)
        ahora = datetime.now(timezone.utc)
        empleados_afectados: list[int] = []
        for item in items:
            if empleado_ids_scope is not None and item.empleado_id not in empleado_ids_scope:
                raise ForbiddenError(
                    "No puedes capturar potencial fuera de tu equipo"
                )
            resultado = await self.repo.get_resultado(ciclo_id, item.empleado_id)
            if resultado is None:
                raise NotFoundError("CicloDesempenoResultado", item.empleado_id)

            datos = await self._calcular_resultado_vivo(
                ciclo, item.empleado_id, participante_by_empleado, escala
            )
            banda_potencial = banda(item.potencial, ciclo.umbral_medio, ciclo.umbral_alto)
            segmento = (
                f"{datos['banda_desempeno']}_{banda_potencial}"
                if datos["banda_desempeno"] is not None
                else None
            )
            await self.repo.upsert_resultado(
                ciclo_id,
                item.empleado_id,
                potencial=item.potencial,
                potencial_capturado_por_id=current_user_id,
                potencial_capturado_at=ahora,
                banda_potencial=banda_potencial,
                segmento_9box=segmento,
            )
            empleados_afectados.append(item.empleado_id)

        return await self.resultados_ciclo(ciclo_id, set(empleados_afectados))

    # ══════════════════════════════════════════════════════════════════════
    # Calibracion (ajuste directo de banda, solo RH global, ciclo activo)
    # ══════════════════════════════════════════════════════════════════════
    async def ajustar_banda(
        self,
        ciclo_id: int,
        items: list[BandaAjusteItem],
        current_user_id: int,
    ) -> list[CicloDesempenoResultadoResponse]:
        """Aplica overrides de banda de desempeno. Exige ciclo `activo`
        (`ConflictError` 409 si no). Por item: `banda_ajustada=None` limpia el
        override (reversion, pone las 4 columnas de auditoria a None);
        `banda_ajustada` in bandas requiere `motivo` no vacio
        (`DomainValidationError` 422 si vacio) y setea override + auditoria.
        `banda_ajustada` fuera de las bandas => 422. Empleado sin resultado en
        el ciclo => `NotFoundError` 404. Recompone `segmento_9box` con la banda
        efectiva. El score numerico `calificacion_desempeno` NO se toca."""
        ciclo = await self._get_ciclo_o_404(ciclo_id)
        if ciclo.estado != "activo":
            raise ConflictError("Solo se puede calibrar un ciclo activo")

        ahora = datetime.now(timezone.utc)
        afectados: list[int] = []
        for item in items:
            resultado = await self.repo.get_resultado(ciclo_id, item.empleado_id)
            if resultado is None:
                raise NotFoundError("CicloDesempenoResultado", item.empleado_id)

            if item.banda_ajustada is None:
                # Reversion: limpia el override y su auditoria.
                banda_efe = banda_efectiva(resultado.banda_desempeno, None)
                campos = dict(
                    banda_desempeno_ajustada=None,
                    banda_ajuste_motivo=None,
                    banda_ajustada_por_id=None,
                    banda_ajustada_at=None,
                )
            else:
                # banda_ajustada invalida ya la rechaza el schema BandaAjusteItem
                # al construirse (field_validator, autoridad unica); este chequeo
                # aqui seria codigo muerto.
                if item.motivo is None or not item.motivo.strip():
                    raise DomainValidationError(
                        "El motivo del ajuste es obligatorio", field="motivo"
                    )
                nueva_ajustada = item.banda_ajustada
                banda_efe = banda_efectiva(resultado.banda_desempeno, nueva_ajustada)
                campos = dict(
                    banda_desempeno_ajustada=nueva_ajustada,
                    banda_ajuste_motivo=item.motivo.strip(),
                    banda_ajustada_por_id=current_user_id,
                    banda_ajustada_at=ahora,
                )

            # Recompone el segmento con la banda efectiva (banda_potencial no cambia).
            segmento = (
                f"{banda_efe}_{resultado.banda_potencial}"
                if banda_efe is not None and resultado.banda_potencial is not None
                else None
            )
            await self.repo.upsert_resultado(
                ciclo_id, item.empleado_id, segmento_9box=segmento, **campos
            )
            afectados.append(item.empleado_id)

        return await self.resultados_ciclo(ciclo_id, set(afectados))

    async def distribucion_ciclo(
        self, ciclo_id: int, empleado_ids_scope: Optional[set[int]] = None
    ) -> DistribucionResponse:
        """Distribucion de bandas EFECTIVAS del ciclo (scope aplicado) vs. la
        distribucion objetivo (config del ciclo o default). `desviacion` =
        pct actual - objetivo por banda."""
        resultados = await self.resultados_ciclo(ciclo_id, empleado_ids_scope)
        bandas = [r.banda_desempeno_efectiva for r in resultados]
        dist = distribucion_bandas(bandas)
        actual = DistribucionBanda(**dist)

        ciclo = await self._get_ciclo_o_404(ciclo_id)
        objetivo = DISTRIBUCION_OBJETIVO_DEFAULT
        if ciclo.config and isinstance(ciclo.config, dict):
            cfg = ciclo.config.get("distribucion_objetivo")
            if isinstance(cfg, dict):
                objetivo = {k: float(cfg.get(k, 0.0)) for k in ("bajo", "medio", "alto")}

        desviacion = {
            k: round(actual.pct.get(k, 0.0) - objetivo.get(k, 0.0), 2)
            for k in ("bajo", "medio", "alto")
        }
        return DistribucionResponse(
            ciclo_id=ciclo_id, actual=actual, objetivo=objetivo, desviacion=desviacion
        )

    # ══════════════════════════════════════════════════════════════════════
    # Resultados / 9-Box
    # ══════════════════════════════════════════════════════════════════════
    async def resultados_ciclo(
        self, ciclo_id: int, empleado_ids_scope: Optional[set[int]] = None
    ) -> list[CicloDesempenoResultadoResponse]:
        """Resultados del ciclo (filtrados por `empleado_ids_scope` si se
        pasa). En `cerrado` devuelve el snapshot persistido; en cualquier
        otro estado (`activo`/`borrador`) calcula en vivo leyendo las
        senales fuente en este instante."""
        ciclo = await self._get_ciclo_o_404(ciclo_id)
        resultados = await self.repo.list_resultados(ciclo_id, empleado_ids_scope)
        nombres = await self.repo.get_nombres_empleados(
            [r.empleado_id for r in resultados]
        )

        if ciclo.estado == "cerrado":
            out = []
            for r in resultados:
                data = CicloDesempenoResultadoResponse.model_validate(r)
                data.empleado_nombre = nombres.get(r.empleado_id)
                data.banda_desempeno_efectiva = banda_efectiva(
                    data.banda_desempeno, data.banda_desempeno_ajustada
                )
                out.append(data)
            return out

        campana, participante_by_empleado, escala = await self._contexto_senales(ciclo)
        out = []
        for r in resultados:
            datos = await self._calcular_resultado_vivo(
                ciclo, r.empleado_id, participante_by_empleado, escala
            )
            banda_potencial = (
                banda(r.potencial, ciclo.umbral_medio, ciclo.umbral_alto)
                if r.potencial is not None
                else None
            )
            banda_efe = banda_efectiva(datos["banda_desempeno"], r.banda_desempeno_ajustada)
            segmento = (
                f"{banda_efe}_{banda_potencial}"
                if banda_efe is not None and banda_potencial is not None
                else None
            )
            out.append(
                CicloDesempenoResultadoResponse(
                    id=r.id,
                    ciclo_id=r.ciclo_id,
                    empleado_id=r.empleado_id,
                    empleado_nombre=nombres.get(r.empleado_id),
                    cumplimiento_metas=_dec(datos["cumplimiento_metas"]),
                    calificacion_360_raw=_dec(datos["calificacion_360_raw"]),
                    calificacion_360_norm=_dec(datos["calificacion_360_norm"]),
                    escala_min=_dec(datos["escala_min"]),
                    escala_max=_dec(datos["escala_max"]),
                    calificacion_desempeno=_dec(datos["calificacion_desempeno"]),
                    peso_metas_efectivo=_dec(datos["peso_metas_efectivo"]),
                    peso_competencias_efectivo=_dec(datos["peso_competencias_efectivo"]),
                    potencial=r.potencial,
                    banda_desempeno=datos["banda_desempeno"],
                    banda_potencial=banda_potencial,
                    segmento_9box=segmento,
                    banda_desempeno_ajustada=r.banda_desempeno_ajustada,
                    banda_desempeno_efectiva=banda_efe,
                    banda_ajuste_motivo=r.banda_ajuste_motivo,
                    banda_ajustada_por_id=r.banda_ajustada_por_id,
                    banda_ajustada_at=r.banda_ajustada_at,
                    potencial_capturado_por_id=r.potencial_capturado_por_id,
                    potencial_capturado_at=r.potencial_capturado_at,
                    snapshot_at=r.snapshot_at,
                )
            )
        return out

    async def construir_9box(
        self, ciclo_id: int, empleado_ids_scope: Optional[set[int]] = None
    ) -> NueveBoxResponse:
        """Agrupa `resultados_ciclo` (ya resuelve vivo/snapshot segun estado)
        en las 9 celdas de la matriz. Resultados sin banda_desempeno o sin
        banda_potencial (senal ausente / potencial no capturado) se excluyen
        de las celdas (no tienen segmento valido)."""
        resultados = await self.resultados_ciclo(ciclo_id, empleado_ids_scope)
        por_celda: dict[tuple[str, str], list[NueveBoxEmpleadoItem]] = {}
        for r in resultados:
            bd_efe = r.banda_desempeno_efectiva
            if bd_efe is None or r.banda_potencial is None:
                continue
            clave = (bd_efe, r.banda_potencial)
            por_celda.setdefault(clave, []).append(
                NueveBoxEmpleadoItem(
                    empleado_id=r.empleado_id,
                    empleado_nombre=r.empleado_nombre,
                    calificacion_desempeno=r.calificacion_desempeno,
                    potencial=r.potencial,
                )
            )
        celdas = [
            CeldaResponse(
                banda_desempeno=bd,
                banda_potencial=bp,
                segmento=f"{bd}_{bp}",
                empleados=por_celda.get((bd, bp), []),
            )
            for bd in CICLO_DESEMPENO_BANDAS
            for bp in CICLO_DESEMPENO_BANDAS
        ]
        return NueveBoxResponse(ciclo_id=ciclo_id, celdas=celdas)

    # ── Self-service (empleado) ───────────────────────────────────────────
    async def mis_resultados(self, empleado_id: int) -> list[MisResultadoResponse]:
        """Resultados SNAPSHOTEADOS del empleado (solo ciclos cerrados;
        mientras un ciclo esta activo su calificacion no es definitiva)."""
        out: list[MisResultadoResponse] = []
        for ciclo in await self.repo.list_ciclos(estado="cerrado"):
            resultado = await self.repo.get_resultado(ciclo.id, empleado_id)
            if resultado is None:
                continue
            out.append(
                MisResultadoResponse(
                    ciclo_id=ciclo.id,
                    ciclo_nombre=ciclo.nombre,
                    calificacion_desempeno=resultado.calificacion_desempeno,
                    cumplimiento_metas=resultado.cumplimiento_metas,
                    calificacion_360_norm=resultado.calificacion_360_norm,
                    banda_desempeno=resultado.banda_desempeno,
                )
            )
        return out

    # ══════════════════════════════════════════════════════════════════════
    # Helpers privados
    # ══════════════════════════════════════════════════════════════════════
    async def _get_ciclo_o_404(self, ciclo_id: int) -> CicloDesempeno:
        ciclo = await self.repo.get_ciclo(ciclo_id)
        if ciclo is None:
            raise NotFoundError("CicloDesempeno", ciclo_id)
        return ciclo

    async def _ciclo_a_response(self, ciclo: CicloDesempeno) -> CicloDesempenoResponse:
        total = await self.repo.count_participantes(ciclo.id)
        data = CicloDesempenoResponse.model_validate(ciclo)
        data.total_participantes = total
        return data

    async def _contexto_senales(
        self, ciclo: CicloDesempeno
    ) -> tuple[Optional[Eval360Campana], dict[int, int], Optional[Eval360Escala]]:
        """Prepara (una sola vez por operacion que itera muchos empleados) el
        contexto de la senal 360: la campana vinculada (con `participantes`
        precargados via `get_campana_detalle`), el mapa `empleado_id ->
        participante_id`, y la escala Likert aplicable (la propia de la
        campana si tiene una asignada; si no, la escala de la config global
        via `Evaluacion360Service.get_or_create_config()` -- mismo patron de
        `Evaluacion360Service._escala_de_campana`, replicado aqui con la
        API publica del otro service/repo en vez de invocar ese metodo
        privado)."""
        if ciclo.eval360_campana_id is None:
            return None, {}, None
        campana = await self.eval360_repo.get_campana_detalle(ciclo.eval360_campana_id)
        if campana is None:
            return None, {}, None
        participante_by_empleado = {p.empleado_id: p.id for p in campana.participantes}
        escala = campana.escala
        if escala is None:
            config = await self.eval360_service.get_or_create_config()
            if config.escala_id is not None:
                escala = await self.eval360_repo.get_escala(config.escala_id)
        return campana, participante_by_empleado, escala

    async def _cumplimiento_metas_o_none(
        self, ciclo: CicloDesempeno, empleado_id: int
    ) -> Optional[float]:
        """`None` = senal AUSENTE (el empleado no tiene metas individuales
        CERRADAS/calificadas en el meta_ciclo vinculado, o no hay meta_ciclo
        vinculado) -- distinto de un cumplimiento `0.0` real (metas cerradas
        con calificacion 0), que SI participa en la combinacion. Se usa
        `MetasRepository.list_metas_cerradas_empleado` (la misma fuente que
        `MetasService.cumplimiento_empleado`) para distinguir ambos casos,
        ya que `cumplimiento_empleado` por si solo devuelve `0.0` en los
        dos (borde documentado ahi)."""
        if ciclo.meta_ciclo_id is None:
            return None
        cerradas = await self.metas_repo.list_metas_cerradas_empleado(
            ciclo.meta_ciclo_id, empleado_id
        )
        if not cerradas:
            return None
        return await self.metas_service.cumplimiento_empleado(
            ciclo.meta_ciclo_id, empleado_id
        )

    async def _calificacion_360_o_none(
        self,
        empleado_id: int,
        participante_by_empleado: dict[int, int],
        escala: Optional[Eval360Escala],
    ) -> tuple[Optional[float], Optional[float], Optional[int], Optional[int]]:
        """`(raw, norm, vmin, vmax)`. Los 4 vienen en `None` juntos cuando la
        senal 360 esta AUSENTE (el empleado no es participante de la campana
        vinculada, no hay campana vinculada, o no tiene fila resumen
        `Eval360Resultado` con `calificacion_general` -- p. ej. campana aun
        sin evaluaciones completadas): no tiene sentido exponer una escala
        sin una calificacion que interpretar. Si hay calificacion, `vmin`/
        `vmax` usan la escala de la campana o el default 1-5 (mismo default
        que `Evaluacion360Service._calcular_resultados_participante`)."""
        participante_id = participante_by_empleado.get(empleado_id)
        if participante_id is None:
            return None, None, None, None
        resultado = await self.eval360_repo.get_resultado_global(participante_id)
        if resultado is None or resultado.calificacion_general is None:
            return None, None, None, None
        vmin = escala.valor_min if escala is not None else 1
        vmax = escala.valor_max if escala is not None else 5
        raw = float(resultado.calificacion_general)
        norm = normalizar_360(raw, vmin, vmax)
        return raw, norm, vmin, vmax

    async def _calcular_resultado_vivo(
        self,
        ciclo: CicloDesempeno,
        empleado_id: int,
        participante_by_empleado: dict[int, int],
        escala: Optional[Eval360Escala],
        indice_historial: Optional[float] = None,
    ) -> dict:
        cumplimiento = await self._cumplimiento_metas_o_none(ciclo, empleado_id)
        raw360, norm360, vmin, vmax = await self._calificacion_360_o_none(
            empleado_id, participante_by_empleado, escala
        )
        score, pm_ef, pc_ef, ph_ef = combinar_score(
            cumplimiento, norm360, indice_historial,
            ciclo.peso_metas, ciclo.peso_competencias, ciclo.peso_historial,
        )
        banda_desempeno = (
            banda(score, ciclo.umbral_medio, ciclo.umbral_alto) if score is not None else None
        )
        return {
            "cumplimiento_metas": cumplimiento,
            "calificacion_360_raw": raw360,
            "calificacion_360_norm": norm360,
            "escala_min": float(vmin) if vmin is not None else None,
            "escala_max": float(vmax) if vmax is not None else None,
            "calificacion_desempeno": score,
            "peso_metas_efectivo": pm_ef,
            "peso_competencias_efectivo": pc_ef,
            "indice_historial": indice_historial,
            "peso_historial_efectivo": ph_ef,
            "banda_desempeno": banda_desempeno,
        }
