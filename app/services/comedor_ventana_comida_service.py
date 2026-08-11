"""Ajustes Comedor: resuelve qué ventana de comida aplica, por turno y por persona.

La cadena que implementa es siempre la misma:

    empleado + fecha → turno efectivo → posición del ciclo → jornada → ventana de comida

Para un turno fijo la jornada sale del día de la semana; para uno rotativo, de la posición
dentro del ciclo. Esa parte no se reimplementa aquí: la calcula
`app.utils.turno_ciclo`, que envuelve al motor ya validado contra lo que TRESS mismo
computó.

**Todo se lee de Bono.** Turnos, jornadas, ventanas y el turno de cada persona viven en
tablas espejo que llenan los syncs de la madrugada, de modo que ninguna carga de pantalla
consulta DATOS_ANALISIS.

Cuando no hay ventana, la respuesta dice **por qué** en vez de devolver horas vacías: un
día de descanso, una jornada que nadie ha configurado y un turno cuyo patrón no se puede
interpretar son tres situaciones distintas y se atienden distinto.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, time
from decimal import Decimal

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainValidationError, NotFoundError
from app.models.empleados import Empleado
from app.models.horarios import Horario
from app.models.turnos import Turno
from app.models.turnos_empleados import TurnoEmpleado
from app.repositories.comedor_repository import ComedorHorarioJornadaRepository
from app.repositories.datos_analisis_descansos_repository import parse_hora_tress
from app.repositories.turnos_uso_repository import TurnosUsoRepository
from app.schemas.comedor import (
    ComedorJornadaComidaItem,
    ComedorJornadaComidaUpsert,
    ComedorTurnoCicloBloque,
    ComedorTurnoComidaItem,
    ComedorVentanaComidaResponse,
)
from app.utils.audit_logger import audit_background
from app.utils.turno_ciclo import (
    BloqueCiclo,
    TurnoCicloError,
    ancla_valida,
    bloques_del_ciclo,
    jornadas_del_turno,
    longitud_ciclo,
    posicion_en_ciclo,
    tipo_turno,
    turno_tress_desde_modelo,
)
from app.utils.turno_empleado_match import turno_no_empleado_matches

logger = logging.getLogger(__name__)

_AVISO_PATRON_INVALIDO = (
    "El patrón de rotación de este turno usa un formato que el sistema no interpreta; "
    "revísalo en nómina."
)
_AVISO_ANCLA_INVALIDA = (
    "Este turno es rotativo pero no tiene fecha de inicio de ciclo en nómina, así que no "
    "se puede saber qué día del ciclo le toca."
)


@dataclass(frozen=True, slots=True)
class VentanaResuelta:
    """Ventana de comida de un (empleado, fecha), en la forma mínima que usa el tablero.

    Es deliberadamente más pobre que `ComedorVentanaComidaResponse`: la resolución masiva
    corre sobre decenas de miles de filas y no necesita descripciones ni avisos, solo el
    horario al que hay que servir. `ho_codigo` en `None` significa que ese acceso no tiene
    comida asignada, y `motivo` dice por qué.
    """

    tu_codigo: str | None = None
    ho_codigo: str | None = None
    hora_inicio_comida: time | None = None
    hora_fin_comida: time | None = None
    motivo: str | None = None


@dataclass(frozen=True, slots=True)
class _Contexto:
    """Todo lo que hace falta de Bono, leído una sola vez por petición."""

    turnos: list[Turno]
    jornadas: dict[str, Horario]
    ventanas: dict[str, object]
    conteos: dict[str, int]


def _horas_de(jornada: Horario | None) -> tuple[time | None, time | None, float | None]:
    if jornada is None:
        return None, None, None
    horas = jornada.ho_jornada
    return (
        parse_hora_tress(jornada.ho_intime),
        parse_hora_tress(jornada.ho_outtime),
        float(horas) if isinstance(horas, (Decimal, int, float)) else None,
    )


class ComedorVentanaComidaService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ComedorHorarioJornadaRepository(db)
        self.turnos_uso_repo = TurnosUsoRepository(db)

    async def _contexto(self, *, incluir_inactivos: bool = False) -> _Contexto:
        return _Contexto(
            turnos=await self.repo.list_turnos(incluir_inactivos=incluir_inactivos),
            jornadas=await self.repo.map_jornadas(),
            ventanas=await self.repo.map_ventanas(),
            conteos=await self.turnos_uso_repo.map_conteos(),
        )

    # --- Resumen de turnos con su ciclo ---

    def _bloque_item(
        self, bloque: BloqueCiclo, ctx: _Contexto
    ) -> ComedorTurnoCicloBloque:
        jornada = ctx.jornadas.get(bloque.ho_codigo or "")
        ventana = ctx.ventanas.get(bloque.ho_codigo or "")
        entrada, salida, _ = _horas_de(jornada)
        return ComedorTurnoCicloBloque(
            dia_inicio=bloque.dia_inicio,
            dia_fin=bloque.dia_fin,
            dias=bloque.dias,
            etiqueta=bloque.etiqueta,
            estatus=bloque.estatus,
            ho_codigo=bloque.ho_codigo,
            ho_descripcion=(jornada.ho_descrip or "").strip() if jornada else None,
            hora_entrada=entrada,
            hora_salida=salida,
            # Un día de descanso nunca lleva ventana de comida, aunque su jornada esté
            # configurada para los días en que sí se trabaja.
            hora_inicio_comida=(
                ventana.hora_inicio_comida  # type: ignore[union-attr]
                if ventana and bloque.estatus == "LABORABLE"
                else None
            ),
            hora_fin_comida=(
                ventana.hora_fin_comida  # type: ignore[union-attr]
                if ventana and bloque.estatus == "LABORABLE"
                else None
            ),
            configurada=bool(ventana) and bloque.estatus == "LABORABLE",
        )

    def _turno_item(self, turno: Turno, ctx: _Contexto) -> ComedorTurnoComidaItem:
        tt = turno_tress_desde_modelo(turno)
        codigo = (turno.tu_codigo or "").strip()
        base = ComedorTurnoComidaItem(
            tu_codigo=codigo,
            descripcion=(turno.tu_descrip or "").strip(),
            activo=(turno.tu_activo or "").strip().upper() == "S",
            tipo_turno=tipo_turno(tt),
            jornada_horas=float(turno.tu_jornada) if turno.tu_jornada is not None else None,
            dias_semana=turno.tu_dias,
            empleados_activos=ctx.conteos.get(codigo),
        )

        try:
            bloques = bloques_del_ciclo(tt)
            jornadas = jornadas_del_turno(tt)
            largo = longitud_ciclo(tt)
        except TurnoCicloError as exc:
            # La fila se degrada con un aviso; la pantalla no se cae por un turno roto.
            return base.model_copy(
                update={
                    "aviso": _AVISO_PATRON_INVALIDO
                    if exc.motivo == "PATRON_INVALIDO"
                    else _AVISO_ANCLA_INVALIDA
                }
            )

        aviso = None if ancla_valida(tt) else _AVISO_ANCLA_INVALIDA
        return base.model_copy(
            update={
                "longitud_ciclo": largo,
                "jornadas": jornadas,
                "jornadas_configuradas": sum(1 for j in jornadas if j in ctx.ventanas),
                "bloques": [self._bloque_item(b, ctx) for b in bloques],
                "aviso": aviso,
            }
        )

    async def resumen_turnos(
        self, *, incluir_inactivos: bool = False, solo_en_uso: bool = True
    ) -> list[ComedorTurnoComidaItem]:
        """Turnos del catálogo con su ciclo desglosado.

        `solo_en_uso` recorta el catálogo (76 turnos) a los que TRESS reporta con gente
        —hoy 24— usando la caché `levelup_turnos_uso`. **Caché vacía ⇒ no se filtra**:
        antes de la primera corrida del sync, filtrar dejaría la pantalla sin un solo turno.

        Aquí **no** aplica la salvaguarda de «lo ya configurado nunca se oculta» que sí
        tiene la lista de jornadas. Con la configuración colgando de la jornada, un turno
        hereda como configurado cualquier jornada compartida —la de 06:00-14:00 la usan
        16 turnos del catálogo—, así que esa excepción dejaría pasar casi todo y el filtro
        de «solo turnos en uso» no filtraría nada. Lo que hay que proteger es el dato
        capturado, y ese vive en la jornada, no en el turno.
        """
        ctx = await self._contexto(incluir_inactivos=incluir_inactivos)
        items: list[ComedorTurnoComidaItem] = []
        for turno in ctx.turnos:
            item = self._turno_item(turno, ctx)
            if solo_en_uso and ctx.conteos and not (item.empleados_activos or 0) > 0:
                continue
            items.append(item)
        return items

    # --- Jornadas: la superficie editable ---

    def _uso_de_jornadas(self, ctx: _Contexto) -> dict[str, tuple[list[str], int, bool]]:
        """`{ho_codigo: (turnos que la usan, personal, viene de un turno en uso)}`.

        Cuando la caché de uso tiene datos, la lista de turnos incluye **solo los que
        tienen personal**. Es lo que hace útil el aviso de alcance: decir «afecta a G5,
        G7, G9, G11» es accionable, mientras que enumerar los 16 turnos del catálogo que
        declaran esa jornada —la mitad sin una sola persona— no dice nada.
        """
        uso: dict[str, tuple[list[str], int, bool]] = {}
        for turno in ctx.turnos:
            codigo = (turno.tu_codigo or "").strip()
            try:
                jornadas = jornadas_del_turno(turno_tress_desde_modelo(turno))
            except TurnoCicloError:
                continue
            personal = ctx.conteos.get(codigo, 0)
            if ctx.conteos and personal <= 0:
                continue
            for ho_codigo in jornadas:
                turnos, total, en_uso = uso.get(ho_codigo, ([], 0, False))
                if codigo not in turnos:
                    turnos.append(codigo)
                uso[ho_codigo] = (turnos, total + personal, en_uso or personal > 0)
        return uso

    def _jornada_item(
        self, ho_codigo: str, ctx: _Contexto, uso: dict[str, tuple[list[str], int, bool]]
    ) -> ComedorJornadaComidaItem:
        jornada = ctx.jornadas.get(ho_codigo)
        ventana = ctx.ventanas.get(ho_codigo)
        entrada, salida, horas = _horas_de(jornada)
        turnos, personal, _ = uso.get(ho_codigo, ([], 0, False))
        return ComedorJornadaComidaItem(
            ho_codigo=ho_codigo,
            descripcion=(jornada.ho_descrip or "").strip() if jornada else "",
            hora_entrada=entrada,
            hora_salida=salida,
            jornada_horas=horas,
            activo=(jornada.ho_activo or "").strip().upper() == "S" if jornada else True,
            hora_inicio_comida=ventana.hora_inicio_comida if ventana else None,  # type: ignore[union-attr]
            hora_fin_comida=ventana.hora_fin_comida if ventana else None,  # type: ignore[union-attr]
            actualizado_en=ventana.updated_at if ventana else None,  # type: ignore[union-attr]
            turnos=sorted(turnos),
            empleados_activos=personal if ctx.conteos else None,
            en_catalogo=jornada is not None,
        )

    async def listar_jornadas(
        self, *, solo_en_uso: bool = True
    ) -> list[ComedorJornadaComidaItem]:
        """Jornadas configurables, con el alcance de cada una.

        Se listan las que algún turno del catálogo usa, no las 52 del catálogo de TRESS:
        configurar una jornada que ningún turno recorre no serviría de nada. Mismas dos
        salvaguardas que el resumen de turnos: caché vacía no filtra, y una jornada ya
        configurada nunca se oculta.
        """
        ctx = await self._contexto()
        uso = self._uso_de_jornadas(ctx)
        codigos = set(uso) | set(ctx.ventanas)

        items: list[ComedorJornadaComidaItem] = []
        for ho_codigo in sorted(codigos):
            _, _, en_uso = uso.get(ho_codigo, ([], 0, False))
            if solo_en_uso and ctx.conteos and ho_codigo not in ctx.ventanas and not en_uso:
                continue
            items.append(self._jornada_item(ho_codigo, ctx, uso))
        return items

    async def guardar_ventana(
        self,
        ho_codigo: str,
        data: ComedorJornadaComidaUpsert,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ComedorJornadaComidaItem:
        codigo = (ho_codigo or "").strip()
        if not codigo:
            raise DomainValidationError(detail="Falta el código de jornada.")

        ctx = await self._contexto()
        uso = self._uso_de_jornadas(ctx)
        # Se acepta una jornada que aún no esté en el catálogo replicado siempre que algún
        # turno la referencie: la réplica puede ir por detrás de TRESS y bloquear la
        # captura por eso sería peor que permitirla.
        if codigo not in ctx.jornadas and codigo not in uso:
            raise NotFoundError("Jornada", codigo)

        anterior = ctx.ventanas.get(codigo)
        datos_antes = (
            {
                "hora_inicio_comida": anterior.hora_inicio_comida.isoformat(),  # type: ignore[union-attr]
                "hora_fin_comida": anterior.hora_fin_comida.isoformat(),  # type: ignore[union-attr]
            }
            if anterior
            else None
        )

        ventana = await self.repo.upsert_ventana(
            ho_codigo=codigo,
            hora_inicio=data.hora_inicio_comida,
            hora_fin=data.hora_fin_comida,
            empleado_id=current_user.empleado_id,
        )

        turnos_afectados, personal, _ = uso.get(codigo, ([], 0, False))
        audit_background(
            background_tasks,
            self.db,
            accion="COMEDOR_HORARIO_JORNADA_GUARDADO",
            modulo="comedor",
            usuario_id=current_user.id,
            entidad_id=ventana.id,
            datos_antes=datos_antes,
            datos_despues={
                "ho_codigo": codigo,
                "hora_inicio_comida": data.hora_inicio_comida.isoformat(),
                "hora_fin_comida": data.hora_fin_comida.isoformat(),
                # Los turnos afectados son lo que hace revisable un cambio compartido.
                "turnos_afectados": sorted(turnos_afectados),
                "empleados_afectados": personal,
            },
        )

        ctx_actualizado = await self._contexto()
        return self._jornada_item(codigo, ctx_actualizado, uso)

    # --- Resolución masiva, para el tablero de reporte ---

    async def resolver_ventanas(
        self, pares: Iterable[tuple[int, date]]
    ) -> dict[tuple[int, date], VentanaResuelta]:
        """`{(no_empleado, fecha): ventana}` para muchos pares de una sola vez.

        El tablero de planeación necesita la ventana de cada uno de los ~13 000 accesos
        del rango. Resolverlos con `ventana_por_empleado` costaría tres consultas por
        fila; aquí el contexto se carga **una vez** y el resto se resuelve en memoria,
        memorizando la expansión del ciclo por turno (24 turnos, no 13 000).

        Un par sin ventana aparece igual en el resultado, con `ho_codigo = None`: la
        planeación necesita saber cuántas comidas quedan fuera de horario, no perderlas.
        """
        ctx = await self._contexto(incluir_inactivos=True)
        turnos_por_codigo = {
            (t.tu_codigo or "").strip(): t for t in ctx.turnos
        }
        asignacion = {
            self._clave_no_empleado(f.no_empleado): (f.tu_codigo or "").strip()
            for f in (await self.db.execute(select(TurnoEmpleado))).scalars().all()
        }

        # `codigo_turno -> (bloques, longitud)` o None si su ciclo no se puede calcular.
        ciclos: dict[str, tuple[list[BloqueCiclo], int] | None] = {}

        def ciclo_de(codigo: str):
            if codigo not in ciclos:
                turno = turnos_por_codigo.get(codigo)
                if turno is None:
                    ciclos[codigo] = None
                else:
                    tt = turno_tress_desde_modelo(turno)
                    try:
                        ciclos[codigo] = (bloques_del_ciclo(tt), longitud_ciclo(tt))
                    except TurnoCicloError:
                        ciclos[codigo] = None
            return ciclos[codigo]

        salida: dict[tuple[int, date], VentanaResuelta] = {}
        for no_empleado, fecha in pares:
            clave = (no_empleado, fecha)
            if clave in salida:
                continue
            codigo = asignacion.get(str(int(no_empleado)), "")
            turno = turnos_por_codigo.get(codigo) if codigo else None
            if turno is None:
                salida[clave] = VentanaResuelta(motivo="SIN_TURNO" if not codigo else "TURNO_FUERA_DE_CATALOGO")
                continue

            tt = turno_tress_desde_modelo(turno)
            armado = ciclo_de(codigo)
            if armado is None:
                salida[clave] = VentanaResuelta(tu_codigo=codigo, motivo="PATRON_INVALIDO")
                continue
            try:
                indice = posicion_en_ciclo(tt, fecha)
            except TurnoCicloError as exc:
                salida[clave] = VentanaResuelta(tu_codigo=codigo, motivo=exc.motivo)
                continue

            bloques, _ = armado
            bloque = next(b for b in bloques if b.dia_inicio <= indice + 1 <= b.dia_fin)
            if bloque.estatus == "DESCANSO":
                salida[clave] = VentanaResuelta(tu_codigo=codigo, motivo="DESCANSO")
                continue

            ho_codigo = bloque.ho_codigo or ""
            ventana = ctx.ventanas.get(ho_codigo)
            if not ho_codigo or ventana is None:
                salida[clave] = VentanaResuelta(
                    tu_codigo=codigo,
                    ho_codigo=ho_codigo or None,
                    motivo="JORNADA_SIN_CONFIGURAR",
                )
                continue
            salida[clave] = VentanaResuelta(
                tu_codigo=codigo,
                ho_codigo=ho_codigo,
                hora_inicio_comida=ventana.hora_inicio_comida,  # type: ignore[union-attr]
                hora_fin_comida=ventana.hora_fin_comida,  # type: ignore[union-attr]
            )
        return salida

    @staticmethod
    def _clave_no_empleado(valor: str | None) -> str:
        """Normaliza el número: el seed viejo de Excel dejó filas como `"553.0"`."""
        crudo = (valor or "").strip()
        if not crudo:
            return ""
        try:
            return str(int(float(crudo)))
        except ValueError:
            return crudo

    # --- Empleado + fecha → ventana ---

    async def ventana_por_empleado(
        self, *, no_empleado: int, fecha: date
    ) -> ComedorVentanaComidaResponse:
        fila = (
            await self.db.execute(
                select(TurnoEmpleado).where(turno_no_empleado_matches(no_empleado))
            )
        ).scalars().first()

        base = ComedorVentanaComidaResponse(
            no_empleado=str(int(no_empleado)),
            nombre=(fila.nombre or "").strip() if fila else None,
            fecha=fecha,
            turno_sincronizado_en=fila.sincronizado_en if fila else None,
        )

        tu_codigo = (fila.tu_codigo or "").strip() if fila else ""
        if not tu_codigo:
            return base.model_copy(
                update={
                    "motivo_sin_ventana": "SIN_TURNO",
                    "aviso": (
                        "Esta persona no tiene turno asignado. Si acaba de ingresar, "
                        "aparecerá después de la sincronización de las 04:20."
                    ),
                }
            )

        turno = await self.repo.get_turno(tu_codigo)
        if turno is None:
            return base.model_copy(
                update={
                    "tu_codigo": tu_codigo,
                    "motivo_sin_ventana": "TURNO_FUERA_DE_CATALOGO",
                    "aviso": (
                        f"El turno {tu_codigo} todavía no está en el catálogo replicado "
                        "de nómina."
                    ),
                }
            )

        return await self._resolver(base, turno, fecha)

    async def _resolver(
        self, base: ComedorVentanaComidaResponse, turno: Turno, fecha: date
    ) -> ComedorVentanaComidaResponse:
        tt = turno_tress_desde_modelo(turno)
        datos = {
            "tu_codigo": (turno.tu_codigo or "").strip(),
            "turno_descripcion": (turno.tu_descrip or "").strip(),
            "tipo_turno": tipo_turno(tt),
        }

        try:
            indice = posicion_en_ciclo(tt, fecha)
            ciclo = bloques_del_ciclo(tt)
            largo = longitud_ciclo(tt)
        except TurnoCicloError as exc:
            return base.model_copy(
                update={
                    **datos,
                    "motivo_sin_ventana": exc.motivo,
                    "aviso": _AVISO_PATRON_INVALIDO
                    if exc.motivo == "PATRON_INVALIDO"
                    else _AVISO_ANCLA_INVALIDA,
                }
            )

        bloque = next(b for b in ciclo if b.dia_inicio <= indice + 1 <= b.dia_fin)
        datos.update({"posicion_ciclo": indice + 1, "longitud_ciclo": largo})

        aviso = None
        if tt.es_rotativo and tt.rit_ini is not None and fecha < tt.rit_ini:
            # El módulo sobre un negativo da una posición coherente, pero el ciclo no
            # existía antes de esa fecha: es una extrapolación, y hay que decirlo.
            aviso = (
                f"La fecha es anterior al inicio del ciclo de este turno "
                f"({tt.rit_ini.isoformat()}); el resultado es una proyección hacia atrás."
            )

        if bloque.estatus == "DESCANSO":
            return base.model_copy(
                update={
                    **datos,
                    "estatus": "DESCANSO",
                    "motivo_sin_ventana": "DESCANSO",
                    "aviso": aviso,
                }
            )

        ho_codigo = bloque.ho_codigo or ""
        jornada = await self.repo.get_jornada(ho_codigo) if ho_codigo else None
        entrada, salida, _ = _horas_de(jornada)
        datos.update(
            {
                "estatus": "LABORABLE",
                "ho_codigo": ho_codigo or None,
                "ho_descripcion": (jornada.ho_descrip or "").strip() if jornada else None,
                "hora_entrada": entrada,
                "hora_salida": salida,
            }
        )

        if not ho_codigo:
            return base.model_copy(
                update={
                    **datos,
                    "motivo_sin_ventana": "JORNADA_SIN_CONFIGURAR",
                    "aviso": aviso,
                }
            )

        ventana = await self.repo.get_ventana(ho_codigo)
        if ventana is None:
            return base.model_copy(
                update={
                    **datos,
                    "motivo_sin_ventana": (
                        "JORNADA_SIN_CONFIGURAR"
                        if jornada is not None
                        else "JORNADA_FUERA_DE_CATALOGO"
                    ),
                    "aviso": aviso,
                }
            )

        return base.model_copy(
            update={
                **datos,
                "hora_inicio_comida": ventana.hora_inicio_comida,
                "hora_fin_comida": ventana.hora_fin_comida,
                "aviso": aviso,
            }
        )
