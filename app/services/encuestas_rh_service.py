# app/services/encuestas_rh_service.py
"""Logica de negocio del modulo Encuestas RH (Level Up).

Responsabilidades:
  - CRUD de encuesta/preguntas/opciones (solo en estado borrador).
  - Ciclo de vida: publicar (materializa audiencia + notifica), cerrar
    (manual o automatico via `procesar_cierres_vencidos`, sin reapertura).
  - Resolucion de audiencia por area/turno/rol (preview + materializacion).
  - Responder con soporte de anonimato (desasocia `empleado_id` del "sobre"
    de respuestas cuando la encuesta es anonima).
  - Plantillas predefinidas -> nueva encuesta en borrador.

El commit lo realiza la dependencia `get_db` al cierre del request; aqui solo
se usa flush() (via el repositorio), como el resto de services del proyecto.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
)
from app.models.empleados import Empleado
from app.models.encuestas_rh import (
    Encuesta,
    EncuestaOpcion,
    EncuestaParticipante,
    EncuestaPregunta,
    EncuestaRespuesta,
    EncuestaRespuestaGrupo,
    EncuestaRespuestaOpcion,
)
from app.repositories.encuestas_rh_repository import EncuestasRhRepository
from app.schemas.encuestas_rh import (
    AudienciaAreaConteo,
    AudienciaFiltros,
    AudienciaPreview,
    AudienciaTurnoConteo,
    EncuestaCreate,
    EncuestaResponse,
    EncuestaUpdate,
    MiEncuestaItem,
    OpcionResponse,
    ParticipanteItem,
    PlantillaResponse,
    PreguntaCreate,
    PreguntaResponse,
    PreguntaUpdate,
    PublicarRequest,
    ResponderRequest,
)
from app.services.notificacion_service import NotificacionService

MIS_ENCUESTAS_TARGET_URL = "#/talento/mis-encuestas"

# Campos editables de la encuesta una vez publicada (el resto es inmutable).
_CAMPOS_EDITABLES_PUBLICADA = {"titulo", "descripcion", "fecha_cierre_programada"}


class EncuestasRhService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EncuestasRhRepository(db)
        self.notificaciones = NotificacionService(db)

    # ══════════════════════════════════════════════════════════════════════
    # CRUD encuesta (borrador)
    # ══════════════════════════════════════════════════════════════════════
    async def crear_encuesta(self, data: EncuestaCreate) -> EncuestaResponse:
        if data.creado_por_id is None:
            raise DomainValidationError("creado_por_id es obligatorio para crear una encuesta")

        encuesta = Encuesta(
            titulo=data.titulo,
            descripcion=data.descripcion,
            tipo=data.tipo,
            es_anonima=data.es_anonima,
            umbral_minimo_respuestas=data.umbral_minimo_respuestas,
            recordatorio_cada_dias=data.recordatorio_cada_dias,
            creado_por_id=data.creado_por_id,
            estado="borrador",
        )
        self.db.add(encuesta)
        await self.db.flush()

        for pregunta_data in data.preguntas:
            self._crear_pregunta_obj(encuesta.id, pregunta_data)
        await self.db.flush()

        return await self.obtener_encuesta(encuesta.id)

    async def obtener_encuesta(self, encuesta_id: int) -> EncuestaResponse:
        encuesta = await self.repo.get_detalle(encuesta_id)
        if not encuesta:
            raise NotFoundError("Encuesta", encuesta_id)
        return self._encuesta_to_response(encuesta)

    async def listar_encuestas(self, estado: Optional[str] = None) -> list[EncuestaResponse]:
        encuestas = await self.repo.list_encuestas(estado=estado)
        return [self._encuesta_to_response(e) for e in encuestas]

    async def actualizar_encuesta(
        self, encuesta_id: int, data: EncuestaUpdate
    ) -> EncuestaResponse:
        encuesta = await self.repo.get_detalle(encuesta_id)
        if not encuesta:
            raise NotFoundError("Encuesta", encuesta_id)
        if encuesta.estado == "cerrada":
            raise ConflictError("No se puede editar una encuesta cerrada")

        payload = data.model_dump(exclude_unset=True)

        if encuesta.estado == "publicada":
            campos_no_editables = set(payload) - _CAMPOS_EDITABLES_PUBLICADA
            if campos_no_editables:
                raise DomainValidationError(
                    "Una encuesta publicada solo permite editar titulo, "
                    "descripcion y extender fecha_cierre_programada "
                    f"(campos no permitidos: {', '.join(sorted(campos_no_editables))})"
                )
            if "fecha_cierre_programada" in payload:
                nueva_fecha = payload["fecha_cierre_programada"]
                actual = encuesta.fecha_cierre_programada
                if nueva_fecha is None or (actual is not None and nueva_fecha <= actual):
                    raise DomainValidationError(
                        "La nueva fecha_cierre_programada debe ser posterior a la actual"
                    )

        for key, value in payload.items():
            setattr(encuesta, key, value)
        await self.db.flush()
        return await self.obtener_encuesta(encuesta.id)

    async def eliminar_encuesta(self, encuesta_id: int) -> None:
        encuesta = await self.repo.get_detalle(encuesta_id)
        if not encuesta:
            raise NotFoundError("Encuesta", encuesta_id)
        if encuesta.estado != "borrador":
            raise ConflictError("Solo se pueden borrar encuestas en borrador")
        await self.db.delete(encuesta)
        await self.db.flush()

    # ── Preguntas / opciones (solo borrador) ───────────────────────────────
    def _crear_pregunta_obj(self, encuesta_id: int, data: PreguntaCreate) -> EncuestaPregunta:
        pregunta = EncuestaPregunta(
            encuesta_id=encuesta_id,
            orden=data.orden,
            tipo=data.tipo,
            texto=data.texto,
            requerida=data.requerida,
            seleccion_multiple=data.seleccion_multiple,
            # `opciones=[]` explicito: marca la coleccion como "ya cargada" en
            # el identity map. Sin esto, `agregar_pregunta` (que NO recarga
            # via el repo con selectinload) dispara un lazy-load real al
            # serializar `pregunta.opciones` tras el flush si la pregunta no
            # trae opciones (likert/texto) -> MissingGreenlet en async.
            opciones=[],
        )
        self.db.add(pregunta)
        for opcion_data in data.opciones:
            pregunta.opciones.append(
                EncuestaOpcion(texto=opcion_data.texto, orden=opcion_data.orden)
            )
        return pregunta

    async def _get_encuesta_borrador(self, encuesta_id: int) -> Encuesta:
        encuesta = await self.repo.get_detalle(encuesta_id)
        if not encuesta:
            raise NotFoundError("Encuesta", encuesta_id)
        if encuesta.estado != "borrador":
            raise ConflictError(
                "Las preguntas y opciones solo se pueden modificar en encuestas en borrador"
            )
        return encuesta

    async def agregar_pregunta(
        self, encuesta_id: int, data: PreguntaCreate
    ) -> PreguntaResponse:
        await self._get_encuesta_borrador(encuesta_id)
        pregunta = self._crear_pregunta_obj(encuesta_id, data)
        await self.db.flush()
        return self._pregunta_to_response(pregunta)

    async def actualizar_pregunta(
        self, encuesta_id: int, pregunta_id: int, data: PreguntaUpdate
    ) -> PreguntaResponse:
        encuesta = await self._get_encuesta_borrador(encuesta_id)
        pregunta = next((p for p in encuesta.preguntas if p.id == pregunta_id), None)
        if not pregunta:
            raise NotFoundError("Pregunta", pregunta_id)

        payload = data.model_dump(exclude_unset=True, exclude={"opciones"})
        for key, value in payload.items():
            setattr(pregunta, key, value)

        if data.opciones is not None:
            # Se muta la coleccion ORM (no `db.delete`/`db.add` sueltos) para que
            # el cascade "delete-orphan" dispare los DELETE/INSERT y, sobre todo,
            # para que `pregunta.opciones` quede sincronizada en el identity map
            # (si no, una lectura posterior en la misma sesion devuelve la
            # coleccion vieja cacheada en vez del estado recien escrito).
            for opcion in list(pregunta.opciones):
                pregunta.opciones.remove(opcion)
            for opcion_data in data.opciones:
                pregunta.opciones.append(
                    EncuestaOpcion(texto=opcion_data.texto, orden=opcion_data.orden)
                )
        await self.db.flush()

        return self._pregunta_to_response(pregunta)

    async def eliminar_pregunta(self, encuesta_id: int, pregunta_id: int) -> None:
        encuesta = await self._get_encuesta_borrador(encuesta_id)
        pregunta = next((p for p in encuesta.preguntas if p.id == pregunta_id), None)
        if not pregunta:
            raise NotFoundError("Pregunta", pregunta_id)
        # Mutar la coleccion del padre (no `db.delete` suelto) para que el
        # cascade "delete-orphan" dispare el DELETE y `encuesta.preguntas`
        # quede sincronizada en el identity map (ver nota en actualizar_pregunta).
        encuesta.preguntas.remove(pregunta)
        await self.db.flush()

    # ══════════════════════════════════════════════════════════════════════
    # Audiencia
    # ══════════════════════════════════════════════════════════════════════
    async def _resolver_audiencia(self, filtros: AudienciaFiltros) -> list[Empleado]:
        candidatos = await self.repo.list_empleados_activos()

        areas = set(filtros.areas) if filtros.areas else None
        turnos = {t.strip().upper() for t in filtros.turnos if t.strip()} if filtros.turnos else None
        roles = {r.strip().lower() for r in filtros.roles if r.strip()} if filtros.roles else None

        resultado: list[Empleado] = []
        for empleado in candidatos:
            if areas is not None and empleado.area_id not in areas:
                continue
            if roles is not None:
                rol = empleado.rol
                rol_nombre = rol.nombre.strip().lower() if rol else None
                if rol_nombre not in roles:
                    continue
            if turnos is not None:
                turno_valor = self._turno_normalizado(empleado)
                if turno_valor is None or turno_valor not in turnos:
                    continue
            resultado.append(empleado)
        return resultado

    @staticmethod
    def _turno_normalizado(empleado: Empleado) -> Optional[str]:
        te = empleado.turno_empleado
        if not te or not te.turno:
            return None
        valor = te.turno.strip().upper()
        return valor or None

    async def preview_audiencia(self, filtros: AudienciaFiltros) -> AudienciaPreview:
        empleados = await self._resolver_audiencia(filtros)

        por_area: dict[tuple[Optional[int], Optional[str]], int] = {}
        por_turno: dict[Optional[str], int] = {}
        for empleado in empleados:
            area_key = (
                empleado.area_id,
                empleado.area.descripcion if empleado.area else None,
            )
            por_area[area_key] = por_area.get(area_key, 0) + 1

            turno_valor = self._turno_normalizado(empleado)
            por_turno[turno_valor] = por_turno.get(turno_valor, 0) + 1

        return AudienciaPreview(
            total=len(empleados),
            por_area=[
                AudienciaAreaConteo(area_id=area_id, area_nombre=area_nombre, total=total)
                for (area_id, area_nombre), total in por_area.items()
            ],
            por_turno=[
                AudienciaTurnoConteo(turno=turno, total=total)
                for turno, total in por_turno.items()
            ],
        )

    async def _materializar_participantes(
        self, encuesta_id: int, empleados: list[Empleado]
    ) -> list[Empleado]:
        """Crea EncuestaParticipante en pendiente por cada empleado que aun no
        lo es (idempotente). Devuelve los empleados recien materializados."""
        existentes = await self.repo.list_empleado_ids_participantes(encuesta_id)
        nuevos: list[Empleado] = []
        for empleado in empleados:
            if empleado.empleado_id in existentes:
                continue
            self.db.add(
                EncuestaParticipante(
                    encuesta_id=encuesta_id,
                    empleado_id=empleado.empleado_id,
                    estado="pendiente",
                )
            )
            nuevos.append(empleado)
        await self.db.flush()
        return nuevos

    # ══════════════════════════════════════════════════════════════════════
    # Ciclo de vida
    # ══════════════════════════════════════════════════════════════════════
    async def publicar_encuesta(
        self, encuesta_id: int, data: PublicarRequest
    ) -> EncuestaResponse:
        encuesta = await self.repo.get_detalle(encuesta_id)
        if not encuesta:
            raise NotFoundError("Encuesta", encuesta_id)
        if encuesta.estado != "borrador":
            raise ConflictError("Solo las encuestas en borrador se pueden publicar")

        if not encuesta.preguntas:
            raise DomainValidationError("La encuesta debe tener al menos una pregunta")
        for pregunta in encuesta.preguntas:
            if pregunta.tipo == "opcion_multiple" and len(pregunta.opciones) < 2:
                raise DomainValidationError(
                    f"La pregunta de opcion multiple '{pregunta.texto}' "
                    "debe tener al menos 2 opciones"
                )

        if data.fecha_cierre_programada <= date.today():
            raise DomainValidationError("fecha_cierre_programada debe ser una fecha futura")

        empleados = await self._resolver_audiencia(data.filtros)
        if not empleados:
            raise DomainValidationError("La audiencia resuelta con esos filtros esta vacia")

        encuesta.audiencia_criterios = data.filtros.model_dump()
        encuesta.fecha_publicacion = datetime.now(timezone.utc)
        encuesta.fecha_cierre_programada = data.fecha_cierre_programada
        encuesta.estado = "publicada"
        await self.db.flush()

        nuevos = await self._materializar_participantes(encuesta.id, empleados)

        for empleado in nuevos:
            await self.notificaciones.enviar(
                destinatario_id=empleado.empleado_id,
                asunto=f"Nueva encuesta: {encuesta.titulo}",
                cuerpo=(
                    f"Se te ha invitado a responder la encuesta '{encuesta.titulo}'. "
                    "Tu participacion es importante."
                ),
                canal="in_app",
                target_url=MIS_ENCUESTAS_TARGET_URL,
                metadata={"encuesta_id": encuesta.id},
            )

        return await self.obtener_encuesta(encuesta.id)

    async def cerrar_encuesta(self, encuesta_id: int) -> EncuestaResponse:
        encuesta = await self.repo.get_detalle(encuesta_id)
        if not encuesta:
            raise NotFoundError("Encuesta", encuesta_id)
        if encuesta.estado != "publicada":
            raise ConflictError("Solo las encuestas publicadas se pueden cerrar")
        encuesta.estado = "cerrada"
        encuesta.fecha_cierre_real = datetime.now(timezone.utc)
        await self.db.flush()
        return await self.obtener_encuesta(encuesta.id)

    async def procesar_cierres_vencidos(self) -> int:
        """Cierra automaticamente las encuestas publicadas cuya fecha de
        cierre programada ya paso. Pensado para invocarse desde un botón
        manual / CLI (no hay job de scheduler para este modulo)."""
        hoy = date.today()
        vencidas = await self.repo.list_publicadas_vencidas(hoy)
        for encuesta in vencidas:
            encuesta.estado = "cerrada"
            encuesta.fecha_cierre_real = datetime.now(timezone.utc)
        await self.db.flush()
        return len(vencidas)

    # ══════════════════════════════════════════════════════════════════════
    # Responder
    # ══════════════════════════════════════════════════════════════════════
    async def responder(
        self, encuesta_id: int, empleado_id: int, payload: ResponderRequest
    ) -> None:
        encuesta = await self.repo.get_detalle(encuesta_id)
        if not encuesta:
            raise NotFoundError("Encuesta", encuesta_id)

        participante = await self.repo.get_participante(encuesta_id, empleado_id)
        if not participante:
            raise ForbiddenError("No eres participante de esta encuesta")

        if encuesta.estado != "publicada":
            raise ConflictError("La encuesta no esta publicada")
        if participante.estado == "respondida":
            raise ConflictError("Ya respondiste esta encuesta")

        preguntas_por_id = {p.id: p for p in encuesta.preguntas}
        respondidas_ids: set[int] = set()

        for item in payload.respuestas:
            pregunta = preguntas_por_id.get(item.pregunta_id)
            if not pregunta:
                raise DomainValidationError(
                    f"La pregunta {item.pregunta_id} no pertenece a esta encuesta"
                )

            if pregunta.tipo == "likert":
                if item.valor_likert is None:
                    continue
                if not (1 <= item.valor_likert <= 5):
                    raise DomainValidationError(
                        f"valor_likert fuera de rango (1..5) en pregunta {pregunta.id}"
                    )
                respondidas_ids.add(pregunta.id)
            elif pregunta.tipo == "texto":
                if item.texto is None or not item.texto.strip():
                    continue
                respondidas_ids.add(pregunta.id)
            elif pregunta.tipo == "opcion_multiple":
                if not item.opcion_ids:
                    continue
                opciones_validas = {o.id for o in pregunta.opciones}
                for opcion_id in item.opcion_ids:
                    if opcion_id not in opciones_validas:
                        raise DomainValidationError(
                            f"La opcion {opcion_id} no pertenece a la pregunta {pregunta.id}"
                        )
                if not pregunta.seleccion_multiple and len(item.opcion_ids) != 1:
                    raise DomainValidationError(
                        f"La pregunta {pregunta.id} acepta exactamente 1 opcion"
                    )
                respondidas_ids.add(pregunta.id)

        for pregunta in encuesta.preguntas:
            if pregunta.requerida and pregunta.id not in respondidas_ids:
                raise DomainValidationError(
                    f"Falta responder la pregunta requerida: {pregunta.texto}"
                )

        empleado = participante.empleado
        es_anonima = encuesta.es_anonima
        grupo_id = uuid4()
        grupo = EncuestaRespuestaGrupo(
            id=grupo_id,
            encuesta_id=encuesta_id,
            empleado_id=None if es_anonima else empleado_id,
            segmento_area=empleado.area.descripcion if empleado and empleado.area else None,
            segmento_turno=self._turno_normalizado(empleado) if empleado else None,
            segmento_clasificacion=(
                empleado.clasificacion.descripcion
                if empleado and empleado.clasificacion
                else None
            ),
            fecha_dia=date.today(),
            created_at=None if es_anonima else datetime.now(timezone.utc),
        )
        self.db.add(grupo)

        respuestas_creadas: list[tuple[EncuestaRespuesta, list[int]]] = []
        for item in payload.respuestas:
            pregunta = preguntas_por_id.get(item.pregunta_id)
            if not pregunta or pregunta.id not in respondidas_ids:
                continue
            respuesta = EncuestaRespuesta(
                grupo_id=grupo_id,
                pregunta_id=pregunta.id,
                valor_likert=item.valor_likert if pregunta.tipo == "likert" else None,
                texto=item.texto if pregunta.tipo == "texto" else None,
            )
            self.db.add(respuesta)
            respuestas_creadas.append((respuesta, item.opcion_ids or []))

        await self.db.flush()

        for respuesta, opcion_ids in respuestas_creadas:
            for opcion_id in opcion_ids:
                self.db.add(
                    EncuestaRespuestaOpcion(respuesta_id=respuesta.id, opcion_id=opcion_id)
                )

        participante.estado = "respondida"
        participante.fecha_respuesta = datetime.now(timezone.utc)
        await self.db.flush()

    # ══════════════════════════════════════════════════════════════════════
    # Mis encuestas
    # ══════════════════════════════════════════════════════════════════════
    async def listar_mis_encuestas(self, empleado_id: int) -> list[MiEncuestaItem]:
        participaciones = await self.repo.list_participaciones_empleado(empleado_id)
        return [
            MiEncuestaItem(
                encuesta_id=p.encuesta_id,
                titulo=p.encuesta.titulo,
                tipo=p.encuesta.tipo,
                estado=p.encuesta.estado,
                participante_estado=p.estado,
                fecha_respuesta=p.fecha_respuesta,
                fecha_cierre_programada=p.encuesta.fecha_cierre_programada,
                es_anonima=p.encuesta.es_anonima,
            )
            for p in participaciones
        ]

    async def obtener_para_responder(
        self, encuesta_id: int, empleado_id: int
    ) -> EncuestaResponse:
        encuesta = await self.repo.get_detalle(encuesta_id)
        if not encuesta:
            raise NotFoundError("Encuesta", encuesta_id)
        participante = await self.repo.get_participante(encuesta_id, empleado_id)
        if not participante:
            raise ForbiddenError("No eres participante de esta encuesta")
        if encuesta.estado != "publicada":
            raise ConflictError("La encuesta no esta publicada")
        return self._encuesta_to_response(encuesta)

    async def listar_participantes(self, encuesta_id: int) -> list[ParticipanteItem]:
        encuesta = await self.repo.get(encuesta_id)
        if not encuesta:
            raise NotFoundError("Encuesta", encuesta_id)
        participantes = await self.repo.list_participantes(encuesta_id)
        return [
            ParticipanteItem(
                empleado_id=p.empleado_id,
                empleado_nombre=p.empleado.nombre if p.empleado else None,
                estado=p.estado,
                fecha_respuesta=p.fecha_respuesta,
            )
            for p in participantes
        ]

    # ══════════════════════════════════════════════════════════════════════
    # Plantillas
    # ══════════════════════════════════════════════════════════════════════
    async def listar_plantillas(self) -> list[PlantillaResponse]:
        plantillas = await self.repo.list_plantillas()
        return [PlantillaResponse.model_validate(p) for p in plantillas]

    async def crear_encuesta_desde_plantilla(
        self, plantilla_id: int, creado_por_id: Optional[int], es_anonima: bool = True
    ) -> EncuestaResponse:
        if creado_por_id is None:
            raise DomainValidationError("creado_por_id es obligatorio para crear una encuesta")

        plantilla = await self.repo.get_plantilla(plantilla_id)
        if not plantilla:
            raise NotFoundError("Plantilla", plantilla_id)

        encuesta = Encuesta(
            titulo=plantilla.nombre,
            descripcion=plantilla.descripcion,
            tipo=plantilla.tipo or "otra",
            es_anonima=es_anonima,
            estado="borrador",
            creado_por_id=creado_por_id,
        )
        self.db.add(encuesta)
        await self.db.flush()

        for pregunta_def in plantilla.definicion:
            pregunta = EncuestaPregunta(
                encuesta_id=encuesta.id,
                orden=pregunta_def.get("orden", 1),
                tipo=pregunta_def["tipo"],
                texto=pregunta_def["texto"],
                requerida=pregunta_def.get("requerida", True),
                seleccion_multiple=pregunta_def.get("seleccion_multiple", False),
            )
            self.db.add(pregunta)
            await self.db.flush()
            for orden, texto_opcion in enumerate(pregunta_def.get("opciones") or [], start=1):
                self.db.add(
                    EncuestaOpcion(pregunta_id=pregunta.id, texto=texto_opcion, orden=orden)
                )
        await self.db.flush()

        return await self.obtener_encuesta(encuesta.id)

    # ══════════════════════════════════════════════════════════════════════
    # Helpers de conversion
    # ══════════════════════════════════════════════════════════════════════
    @staticmethod
    def _pregunta_to_response(pregunta: EncuestaPregunta) -> PreguntaResponse:
        return PreguntaResponse(
            id=pregunta.id,
            orden=pregunta.orden,
            tipo=pregunta.tipo,
            texto=pregunta.texto,
            requerida=pregunta.requerida,
            seleccion_multiple=pregunta.seleccion_multiple,
            opciones=[
                OpcionResponse(id=o.id, texto=o.texto, orden=o.orden)
                for o in sorted(pregunta.opciones, key=lambda o: (o.orden or 0, o.id))
            ],
        )

    @classmethod
    def _encuesta_to_response(cls, encuesta: Encuesta) -> EncuestaResponse:
        return EncuestaResponse(
            id=encuesta.id,
            titulo=encuesta.titulo,
            descripcion=encuesta.descripcion,
            tipo=encuesta.tipo,
            es_anonima=encuesta.es_anonima,
            umbral_minimo_respuestas=encuesta.umbral_minimo_respuestas,
            estado=encuesta.estado,
            fecha_publicacion=encuesta.fecha_publicacion,
            fecha_cierre_programada=encuesta.fecha_cierre_programada,
            fecha_cierre_real=encuesta.fecha_cierre_real,
            audiencia_criterios=encuesta.audiencia_criterios,
            recordatorio_cada_dias=encuesta.recordatorio_cada_dias,
            creado_por_id=encuesta.creado_por_id,
            created_at=encuesta.created_at,
            preguntas=[
                cls._pregunta_to_response(p)
                for p in sorted(encuesta.preguntas, key=lambda p: (p.orden, p.id))
            ],
        )
