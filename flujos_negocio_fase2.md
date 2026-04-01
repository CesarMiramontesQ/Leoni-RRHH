Memoria guardada. A continuación la especificación completa de los 6 flujos.

---

# Especificacion de Flujos de Negocio — Plataforma RH Leoni Cable
**Version:** 1.0 | **Fecha:** 2026-03-30 | **Destino:** fastapi-backend-architect

---

## FLUJO 1 — Solicitudes (Vacaciones / Home Office)

### Diagrama de estados

```
                           [EMPLEADO crea]
                                  |
                                  v
                             +----------+
                 CANCEL ----<| PENDING  |>---- OVERRIDE (Director/RH)
                 (empleado)  | nivel=1  |      |
                             +----------+      v
                                  |       OVERRIDDEN ──> APPROVED o REJECTED
                             APPROVE           
                           (supervisor)        
                                  |            
                                  v            
                             +----------+      
                             | PENDING  |      
                             | nivel=2  |<---- OVERRIDE en cualquier nivel
                             +----------+      
                                  |            
                             APPROVE           
                            (gerente)          
                                  |            
                                  v            
                             +----------+      
                             | PENDING  |      
                             | nivel=3  |      
                             +----------+      
                                  |            
                             APPROVE           
                            (director)         
                                  |            
                                  v            
                             +----------+      
                             | PENDING  |      
                             | nivel=4  |      
                             +----------+      
                                  |            
                             APPROVE (rh)      
                                  |            
                            +-----+-----+      
                            |           |      
                            v           v      
                        APPROVED    REJECTED   
                        (final)     (final)    
                                               
               REJECTED es final en cualquier nivel.
               CANCELLED solo desde PENDING (cualquier nivel).
               OVERRIDDEN es estado intermedio que deriva en APPROVED/REJECTED.
```

### Tabla de transiciones

| Actor | Accion | Estado anterior | Estado nuevo | Condicion | Side effects |
|---|---|---|---|---|---|
| empleado | crear solicitud | — | PENDING (nivel=1) | activo=True; no hay solicitud solapada del mismo tipo para las mismas fechas | Si tipo=vacaciones: SQL Read saldo TRESS; registrar en audit_log |
| empleado | cancelar | PENDING (cualquier nivel) | CANCELLED | solo el propio empleado; estado actual = pending | audit_log; notificar a aprobador del nivel actual |
| supervisor | aprobar nivel 1 | PENDING nivel=1 | PENDING nivel=2 | rol=supervisor; es supervisor del empleado; solicitud.nivel_actual==1 | Crear SolicitudAprobacion(accion='approve', nivel=1); audit_log; notificar gerente |
| supervisor | rechazar nivel 1 | PENDING nivel=1 | REJECTED | rol=supervisor; es supervisor del empleado; solicitud.nivel_actual==1 | Crear SolicitudAprobacion(accion='reject', nivel=1); audit_log; notificar empleado |
| gerente | aprobar nivel 2 | PENDING nivel=2 | PENDING nivel=3 | rol=gerente; solicitud.nivel_actual==2 | Crear SolicitudAprobacion(accion='approve', nivel=2); audit_log; notificar director |
| gerente | rechazar nivel 2 | PENDING nivel=2 | REJECTED | rol=gerente; solicitud.nivel_actual==2 | Crear SolicitudAprobacion(accion='reject', nivel=2); audit_log; notificar empleado |
| director | aprobar nivel 3 | PENDING nivel=3 | PENDING nivel=4 | rol=director; solicitud.nivel_actual==3 | Crear SolicitudAprobacion(accion='approve', nivel=3); audit_log; notificar rh |
| director | rechazar nivel 3 | PENDING nivel=3 | REJECTED | rol=director; solicitud.nivel_actual==3 | Crear SolicitudAprobacion(accion='reject', nivel=3); audit_log; notificar empleado |
| rh | aprobar nivel 4 | PENDING nivel=4 | APPROVED | rol=rh; solicitud.nivel_actual==4 | Crear SolicitudAprobacion(accion='approve', nivel=4); si tipo=vacaciones: encolar tress_robot_queue; audit_log; notificar empleado |
| rh | rechazar nivel 4 | PENDING nivel=4 | REJECTED | rol=rh; solicitud.nivel_actual==4 | Crear SolicitudAprobacion(accion='reject', nivel=4); audit_log; notificar empleado |
| director o rh | override aprobar | PENDING (cualquier nivel) | APPROVED | rol in (director, rh); solicitud.estado==pending | Crear SolicitudAprobacion(accion='override', nivel=nivel_actual); si tipo=vacaciones: encolar tress_robot_queue; audit_log; notificar empleado + niveles salteados |
| director o rh | override rechazar | PENDING (cualquier nivel) | REJECTED | rol in (director, rh); solicitud.estado==pending | Crear SolicitudAprobacion(accion='override', nivel=nivel_actual); audit_log; notificar empleado |

### Reglas de negocio

**Validacion**
- RN-001: Solo el empleado cuyo `id == solicitud.empleado_id` puede crear su propia solicitud. El endpoint no acepta `empleado_id` arbitrario desde el body — se toma del JWT.
- RN-002: El empleado debe tener `activo=True` para poder crear una solicitud.
- RN-003: No pueden existir dos solicitudes del mismo empleado, mismo tipo, con fechas solapadas y con estado en `(PENDING, APPROVED)`. La deteccion de solape es: `fecha_inicio_nueva <= fecha_fin_existente AND fecha_fin_nueva >= fecha_inicio_existente`.
- RN-004: `fecha_inicio` debe ser menor o igual a `fecha_fin`. Para home office aplica el mismo criterio.
- RN-005: Para tipo `vacaciones`, antes de crear la solicitud se debe consultar el saldo disponible en TRESS via SQL Read. Si el saldo es insuficiente, rechazar con 422 y mensaje explicito. **Supuesto:** TRESS expone una vista SQL `v_saldos_vacaciones` con `(num_empleado, dias_disponibles)`.

**Autorizacion**
- RN-006: Un aprobador solo puede actuar sobre una solicitud cuyo `nivel_actual` coincide con su nivel de rol: supervisor=1, gerente=2, director=3, rh=4.
- RN-007: Director y RH pueden actuar sobre una solicitud en cualquier `nivel_actual` (override jerarquico). Esto no requiere que los niveles anteriores hayan aprobado.
- RN-008: El supervisor que aprueba debe ser el supervisor directo del empleado (`empleado.supervisor_id == aprobador.id`). Si el supervisor asignado no coincide con el aprobador, rechazar con 403.
- RN-009: Un empleado no puede aprobar su propia solicitud aunque tenga rol director o rh.

**Calculo y avance de nivel**
- RN-010: Al aprobar en nivel `n`, si `n < 4`, `solicitud.nivel_actual = n + 1` y el estado permanece PENDING. Si `n == 4` (solo rh puede estar en nivel 4), `solicitud.estado = APPROVED`.
- RN-011: Al rechazar en cualquier nivel, `solicitud.estado = REJECTED` (estado final, no avanza).
- RN-012: El override fija `solicitud.estado` directamente en APPROVED o REJECTED segun la intencion del actor, sin modificar `nivel_actual` de forma incremental. Se registra `SolicitudAprobacion.nivel = solicitud.nivel_actual` al momento del override.

**Cancelacion**
- RN-013: El empleado puede cancelar su solicitud solo mientras `estado == PENDING`, independientemente del nivel actual. Una vez APPROVED, REJECTED o CANCELLED no puede modificarse.

**TRESS**
- RN-014: Al transicionar a APPROVED (por aprobacion normal nivel 4 o por override) y `tipo == vacaciones`: insertar en `tress_robot_queue` con `accion='registrar_vacaciones'` y payload `{solicitud_id, empleado_num, fecha_inicio, fecha_fin, dias_solicitados}`. Esta operacion es fire-and-forget.
- RN-015: Para tipo `home_office` no se encola nada en TRESS al aprobarse — no impacta nomina.

**Auditoria**
- RN-016: Cada cambio de estado debe registrar en `audit_log` con `usuario_id`, `modulo='solicitudes'`, `entidad_id=solicitud.id`, `datos_antes={estado_previo, nivel_previo}`, `datos_despues={estado_nuevo, nivel_nuevo}`.

### Casos borde y manejo

- **CB-001: Supervisor es tambien Director.**
  Condicion: `empleado.supervisor_id` apunta a un empleado con `rol.nombre == 'director'`.
  Comportamiento: Al crear la solicitud, `nivel_actual = 1` pero el sistema detecta que el supervisor tiene rol director. El supervisor-director puede aprobar en nivel 1 como supervisor normal O hacer override como director. Recomendacion de implementacion: crear la solicitud en nivel 1 normalmente; el actor con rol director puede aprobar nivel 1 usando la accion de supervisor (si es el supervisor asignado) o hacer override directamente. No saltarse el nivel en la creacion — dejarlo al actor.

- **CB-002: Empleado sin supervisor asignado (`supervisor_id IS NULL`).**
  Condicion: `empleado.supervisor_id IS NULL`.
  Comportamiento: La solicitud se crea con `nivel_actual = 2` directamente (nivel 1 se omite automaticamente). Se registra en `audit_log` la razon: "nivel 1 omitido — sin supervisor asignado". RH es notificado de la anomalia. Se recomienda que RH resuelva el dato faltante en el perfil del empleado.

- **CB-003: Solicitudes con fechas solapadas.**
  Condicion: Existe otra solicitud del mismo empleado, mismo tipo, en estado PENDING o APPROVED, con fechas que se intersectan.
  Comportamiento: Rechazar la nueva solicitud con HTTP 409 Conflict, mensaje: "Ya existe una solicitud de [tipo] en esas fechas". No crear registro.

- **CB-004: Empleado desactivado con solicitud PENDING.**
  Condicion: `it_sync` cambia `activo=False` para un empleado.
  Comportamiento: El servicio de sync debe ejecutar: `UPDATE solicitudes SET estado='cancelled' WHERE empleado_id=X AND estado='pending'`. Notificar a RH con lista de solicitudes canceladas. Registrar en audit_log con `usuario_id=NULL` (operacion de sistema).

- **CB-005: Gerente intenta aprobar en nivel 1.**
  Condicion: `aprobador.rol.nombre == 'gerente'` y `solicitud.nivel_actual == 1`.
  Comportamiento: Rechazar con HTTP 403. El gerente solo puede actuar en nivel 2. No es override — los overrides son exclusivos de director y rh.

- **CB-006: Director o RH intenta aprobar una solicitud ya en APPROVED/REJECTED/CANCELLED.**
  Comportamiento: Rechazar con HTTP 409. Los estados finales son inmutables.

- **CB-007: Saldo insuficiente de vacaciones en TRESS.**
  Comportamiento: Rechazar la creacion con HTTP 422. Incluir en el response el saldo disponible y los dias solicitados. No crear registro de solicitud.

- **CB-008: TRESS SQL Read no disponible al crear vacaciones.**
  Comportamiento: Rechazar la creacion con HTTP 503, mensaje: "No es posible verificar saldo en este momento. Intente mas tarde." No crear la solicitud si no se puede validar el saldo.

### Pseudocodigo del Service

```python
class SolicitudService:

    async def crear_solicitud(
        self,
        db: AsyncSession,
        empleado_id: int,  # tomado del JWT, no del body
        tipo: str,
        fecha_inicio: date,
        fecha_fin: date,
        comentarios: str | None,
        actor: Empleado,
    ) -> Solicitud:
        # RN-001: solo el propio empleado
        if actor.id != empleado_id:
            raise HTTPException(403, "Solo puedes crear tu propia solicitud")

        # RN-002
        empleado = await EmpleadoRepository(db).get_by_id(empleado_id)
        if not empleado.activo:
            raise HTTPException(422, "Empleado inactivo")

        # RN-004
        if fecha_inicio > fecha_fin:
            raise HTTPException(422, "fecha_inicio debe ser anterior a fecha_fin")

        # RN-003: deteccion de solape
        solapada = await SolicitudRepository(db).existe_solape(
            empleado_id, tipo, fecha_inicio, fecha_fin,
            estados_activos=["pending", "approved"]
        )
        if solapada:
            raise HTTPException(409, "Ya existe una solicitud de ese tipo en esas fechas")

        # RN-005: saldo vacaciones
        if tipo == "vacaciones":
            saldo = await TressReadService.get_saldo_vacaciones(empleado.num_empleado)
            # CB-008: TRESS no disponible
            if saldo is None:
                raise HTTPException(503, "No es posible verificar saldo en este momento")
            dias_solicitados = (fecha_fin - fecha_inicio).days + 1
            if saldo < dias_solicitados:
                raise HTTPException(422, f"Saldo insuficiente: {saldo} dias disponibles, {dias_solicitados} solicitados")

        # CB-002: sin supervisor — saltar nivel 1
        nivel_inicial = 1
        if empleado.supervisor_id is None:
            nivel_inicial = 2
            await AuditLogger.log_action(
                db, usuario_id=None, accion="nivel_1_omitido",
                modulo="solicitudes", entidad_id=None,
                datos_despues={"razon": "sin supervisor", "empleado_id": empleado_id}
            )
            await NotificacionService.notificar(
                destinatarios=["rh"],
                evento="solicitud_sin_supervisor",
                datos={"empleado_id": empleado_id}
            )

        solicitud = Solicitud(
            empleado_id=empleado_id,
            tipo=tipo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            estado="pending",
            nivel_actual=nivel_inicial,
            comentarios=comentarios,
        )
        db.add(solicitud)
        await db.flush()

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="crear_solicitud",
            modulo="solicitudes", entidad_id=solicitud.id,
            datos_antes=None,
            datos_despues={"estado": "pending", "nivel_actual": nivel_inicial, "tipo": tipo}
        )
        await db.commit()
        return solicitud

    async def aprobar_o_rechazar(
        self,
        db: AsyncSession,
        solicitud_id: int,
        accion: str,  # "approve" | "reject"
        actor: Empleado,
        comentario: str | None,
    ) -> Solicitud:
        solicitud = await SolicitudRepository(db).get_by_id(solicitud_id)

        # CB-006: estados finales inmutables
        if solicitud.estado != "pending":
            raise HTTPException(409, "La solicitud no esta en estado pendiente")

        # RN-009: no puede aprobarse a si mismo
        if solicitud.empleado_id == actor.id:
            raise HTTPException(403, "No puedes aprobar tu propia solicitud")

        nivel_actor = self._get_nivel_por_rol(actor.rol.nombre)

        # RN-006: nivel del actor debe coincidir con nivel_actual
        if nivel_actor != solicitud.nivel_actual:
            raise HTTPException(403, f"No tienes permiso para actuar en nivel {solicitud.nivel_actual}")

        # RN-008: supervisor debe ser el supervisor del empleado
        if nivel_actor == 1:
            empleado = await EmpleadoRepository(db).get_by_id(solicitud.empleado_id)
            if empleado.supervisor_id != actor.id:
                raise HTTPException(403, "No eres el supervisor asignado a este empleado")

        datos_antes = {"estado": solicitud.estado, "nivel_actual": solicitud.nivel_actual}

        aprobacion = SolicitudAprobacion(
            solicitud_id=solicitud.id,
            aprobador_id=actor.id,
            accion=accion,
            nivel=solicitud.nivel_actual,
            comentario=comentario,
        )
        db.add(aprobacion)

        if accion == "reject":
            # RN-011
            solicitud.estado = "rejected"
            await NotificacionService.notificar(
                destinatarios=[solicitud.empleado_id],
                evento="solicitud_rechazada",
                datos={"solicitud_id": solicitud.id, "nivel": solicitud.nivel_actual}
            )
        else:
            # RN-010
            if solicitud.nivel_actual < 4:
                solicitud.nivel_actual += 1
                proximo_nivel_actor = self._get_rol_por_nivel(solicitud.nivel_actual)
                await NotificacionService.notificar(
                    destinatarios=[proximo_nivel_actor],
                    evento="solicitud_pendiente_aprobacion",
                    datos={"solicitud_id": solicitud.id, "nivel": solicitud.nivel_actual}
                )
            else:
                # nivel 4 aprobado por rh → APPROVED
                solicitud.estado = "approved"
                await self._post_aprobacion_final(db, solicitud)

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion=f"solicitud_{accion}",
            modulo="solicitudes", entidad_id=solicitud.id,
            datos_antes=datos_antes,
            datos_despues={"estado": solicitud.estado, "nivel_actual": solicitud.nivel_actual}
        )
        await db.commit()
        return solicitud

    async def override(
        self,
        db: AsyncSession,
        solicitud_id: int,
        resultado: str,  # "approved" | "rejected"
        actor: Empleado,
        comentario: str | None,
    ) -> Solicitud:
        # RN-007: solo director o rh
        if actor.rol.nombre not in ("director", "rh"):
            raise HTTPException(403, "Solo Director o RH pueden hacer override")

        solicitud = await SolicitudRepository(db).get_by_id(solicitud_id)
        if solicitud.estado != "pending":
            raise HTTPException(409, "La solicitud no esta en estado pendiente")

        # RN-009
        if solicitud.empleado_id == actor.id:
            raise HTTPException(403, "No puedes hacer override de tu propia solicitud")

        datos_antes = {"estado": solicitud.estado, "nivel_actual": solicitud.nivel_actual}

        aprobacion = SolicitudAprobacion(
            solicitud_id=solicitud.id,
            aprobador_id=actor.id,
            accion="override",
            nivel=solicitud.nivel_actual,
            comentario=comentario,
        )
        db.add(aprobacion)
        solicitud.estado = resultado  # "approved" o "rejected"

        if resultado == "approved":
            await self._post_aprobacion_final(db, solicitud)

        await NotificacionService.notificar(
            destinatarios=[solicitud.empleado_id],
            evento="solicitud_override",
            datos={"solicitud_id": solicitud.id, "resultado": resultado, "por": actor.id}
        )
        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="solicitud_override",
            modulo="solicitudes", entidad_id=solicitud.id,
            datos_antes=datos_antes,
            datos_despues={"estado": solicitud.estado}
        )
        await db.commit()
        return solicitud

    async def cancelar(self, db: AsyncSession, solicitud_id: int, actor: Empleado) -> Solicitud:
        solicitud = await SolicitudRepository(db).get_by_id(solicitud_id)

        # RN-013
        if solicitud.empleado_id != actor.id:
            raise HTTPException(403, "Solo el empleado puede cancelar su solicitud")
        if solicitud.estado != "pending":
            raise HTTPException(409, "Solo se pueden cancelar solicitudes en estado PENDING")

        datos_antes = {"estado": solicitud.estado}
        solicitud.estado = "cancelled"

        await NotificacionService.notificar(
            destinatarios=["aprobador_nivel_actual"],  # resolver dinamicamente
            evento="solicitud_cancelada",
            datos={"solicitud_id": solicitud.id}
        )
        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="cancelar_solicitud",
            modulo="solicitudes", entidad_id=solicitud.id,
            datos_antes=datos_antes, datos_despues={"estado": "cancelled"}
        )
        await db.commit()
        return solicitud

    async def _post_aprobacion_final(self, db: AsyncSession, solicitud: Solicitud) -> None:
        """Side effects cuando solicitud llega a APPROVED."""
        # RN-014: encolar en TRESS solo si es vacaciones
        if solicitud.tipo == "vacaciones":
            empleado = await EmpleadoRepository(db).get_by_id(solicitud.empleado_id)
            dias = (solicitud.fecha_fin - solicitud.fecha_inicio).days + 1
            tress_item = TressRobotQueue(
                accion="registrar_vacaciones",
                payload={
                    "solicitud_id": solicitud.id,
                    "empleado_num": empleado.num_empleado,
                    "fecha_inicio": str(solicitud.fecha_inicio),
                    "fecha_fin": str(solicitud.fecha_fin),
                    "dias_solicitados": dias,
                },
                estado="pending",
                intentos=0,
            )
            db.add(tress_item)
        # RN-015: home_office — sin accion en TRESS
        await NotificacionService.notificar(
            destinatarios=[solicitud.empleado_id],
            evento="solicitud_aprobada",
            datos={"solicitud_id": solicitud.id}
        )

    def _get_nivel_por_rol(self, rol_nombre: str) -> int:
        mapa = {"supervisor": 1, "gerente": 2, "director": 3, "rh": 4}
        return mapa.get(rol_nombre, 0)

    def _get_rol_por_nivel(self, nivel: int) -> str:
        mapa = {1: "supervisor", 2: "gerente", 3: "director", 4: "rh"}
        return mapa.get(nivel, "rh")
```

### Notificaciones disparadas

| Evento | Canal | Destinatarios |
|---|---|---|
| Solicitud creada | in-app | Supervisor del empleado (nivel 1) o gerente si no hay supervisor |
| Nivel aprobado (n < 4) | in-app | Actor del nivel n+1 |
| Solicitud rechazada | in-app + email | Empleado solicitante |
| Solicitud aprobada (APPROVED) | in-app + email | Empleado solicitante |
| Override ejecutado | in-app + email | Empleado + niveles salteados |
| Solicitud cancelada | in-app | Aprobador del nivel actual |
| Solicitud sin supervisor | in-app | RH (anomalia de datos) |

---

## FLUJO 2 — Incidencias

### Diagrama de estados

```
                    [supervisor o rh registra]
                               |
                               v
                          +--------+
                          |  OPEN  |<--- evidencias opcionales aqui
                          +--------+
                               |
                    Requiere: al menos 1 evidencia adjunta
                    Actor: rh o gerente
                               |
                               v
                         +-----------+
                         | IN_REVIEW |<--- evidencias adicionales permitidas
                         +-----------+
                               |
                    Actor: rh o gerente
                    Puede o no generar acta administrativa
                               |
                               v
                         +----------+
                         | RESOLVED |<--- evidencias adicionales aun permitidas
                         +----------+
                               |
                    Actor: rh UNICAMENTE
                    Requiere: accion explicita de firma/cierre por rh
                               |
                               v
                          +--------+
                          | CLOSED |  (final)
                          +--------+
                               |
                    Si tipo in (falta, retardo):
                    encolar tress_robot_queue
```

### Tabla de transiciones

| Actor | Accion | Estado anterior | Estado nuevo | Condicion | Side effects |
|---|---|---|---|---|---|
| supervisor / rh | registrar incidencia | — | OPEN | actor.rol in (supervisor, rh); empleado.activo=True | Crear registro Incidencia; audit_log; notificar rh |
| supervisor / rh / gerente | adjuntar evidencia | OPEN | OPEN (sin cambio) | estado in (open, in_review, resolved); archivo <= 50MB; mime permitido | Crear Evidencia; audit_log |
| rh / gerente | mover a revision | OPEN | IN_REVIEW | actor.rol in (rh, gerente); existe al menos 1 Evidencia activa para esta incidencia | audit_log; notificar rh + gerente |
| rh / gerente | resolver | IN_REVIEW | RESOLVED | actor.rol in (rh, gerente) | audit_log; notificar empleado afectado; (opcional) trigger generacion acta |
| rh | cerrar | RESOLVED | CLOSED | actor.rol == rh; accion explicita de cierre | Si tipo in (falta, retardo): encolar tress_robot_queue; audit_log; notificar empleado |

### Reglas de negocio

**Validacion**
- RN-101: Solo empleados con rol `supervisor` o `rh` pueden registrar una incidencia.
- RN-102: No se puede registrar una incidencia sobre un empleado con `activo=False`. Rechazar con HTTP 422.
- RN-103: Los archivos de evidencia deben cumplir: tamano <= 52_428_800 bytes (50MB) y `mime_type` en `{application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/jpeg, image/png, video/mp4}`.
- RN-104: El campo `tipo` de Incidencia acepta valores de texto libre (String 100 segun modelo), pero el sistema debe validar que `tipo` sea uno de los valores catalogados. **Supuesto:** existira un catalogo de tipos. Hasta confirmar, los tipos con efecto en TRESS son: `falta`, `retardo`. Todos los demas van a RESOLVED/CLOSED sin encolar TRESS.

**Transiciones**
- RN-105: La transicion OPEN → IN_REVIEW requiere que exista al menos una `Evidencia` activa (`activo=True`) vinculada a esta incidencia (`entidad_tipo='incidencia'`, `entidad_id=incidencia.id`). Si no hay evidencias, rechazar con HTTP 422.
- RN-106: Solo RH puede ejecutar la transicion RESOLVED → CLOSED. Esta accion representa la firma de cierre de RH. No es una firma electronica criptografica — es una accion de usuario con rol rh registrada en audit_log.
- RN-107: Las transiciones de estado son estrictamente lineales: OPEN → IN_REVIEW → RESOLVED → CLOSED. No se permiten saltos ni retrocesos.

**Evidencias**
- RN-108: Se pueden adjuntar evidencias mientras el estado sea OPEN, IN_REVIEW o RESOLVED. Una vez CLOSED, no se aceptan nuevas evidencias (rechazar con HTTP 409).
- RN-109: Un archivo de evidencia no se elimina fisicamente — se marca `activo=False` (soft delete).

**TRESS**
- RN-110: Al transicionar a CLOSED, si `incidencia.tipo in ('falta', 'retardo')`: insertar en `tress_robot_queue` con `accion='registrar_incidencia_nomina'` y payload `{incidencia_id, empleado_num, tipo, fecha: incidencia.created_at.date()}`. Fire-and-forget.

**Auditoria**
- RN-111: Cada cambio de estado y cada adjunto de evidencia se registra en `audit_log` con `modulo='incidencias'`.

### Casos borde y manejo

- **CB-101: Incidencia sobre empleado inactivo.**
  Comportamiento: Rechazar con HTTP 422, mensaje: "No se puede registrar incidencia sobre un empleado inactivo". No crear registro.

- **CB-102: Intentar cerrar sin ser RH.**
  Comportamiento: Rechazar con HTTP 403, mensaje: "Solo RH puede cerrar una incidencia".

- **CB-103: Intentar mover a IN_REVIEW sin evidencias.**
  Comportamiento: Rechazar con HTTP 422, mensaje: "Debe adjuntar al menos una evidencia antes de mover a revision". No cambiar estado.

- **CB-104: Adjuntar evidencia en estado CLOSED.**
  Comportamiento: Rechazar con HTTP 409, mensaje: "No se pueden adjuntar evidencias a una incidencia cerrada".

- **CB-105: Archivo de evidencia excede 50MB o tipo no permitido.**
  Comportamiento: Rechazar con HTTP 422 antes de guardar el archivo. No crear registro de Evidencia.

- **CB-106: Incidencia de tipo `falta` — empleado ya tiene una incidencia de falta el mismo dia.**
  Comportamiento: **Pendiente de decision de negocio.** Supuesto actual: se permite registrar multiples incidencias por dia. Se recomienda agregar validacion de duplicado si Leoni lo requiere.

- **CB-107: Retroceso de estado solicitado (ej. de IN_REVIEW a OPEN).**
  Comportamiento: Rechazar con HTTP 409. Los estados solo avanzan.

### Pseudocodigo del Service

```python
class IncidenciaService:

    async def registrar(
        self,
        db: AsyncSession,
        empleado_id: int,
        tipo: str,
        descripcion: str,
        actor: Empleado,
    ) -> Incidencia:
        # RN-101
        if actor.rol.nombre not in ("supervisor", "rh"):
            raise HTTPException(403, "Solo supervisor o RH pueden registrar incidencias")

        # RN-102
        empleado = await EmpleadoRepository(db).get_by_id(empleado_id)
        if not empleado or not empleado.activo:
            raise HTTPException(422, "No se puede registrar incidencia sobre un empleado inactivo")

        incidencia = Incidencia(
            empleado_id=empleado_id,
            tipo=tipo,
            descripcion=descripcion,
            estado="open",
            registrado_por=actor.id,
        )
        db.add(incidencia)
        await db.flush()

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="registrar_incidencia",
            modulo="incidencias", entidad_id=incidencia.id,
            datos_antes=None, datos_despues={"estado": "open", "tipo": tipo}
        )
        await NotificacionService.notificar(
            destinatarios=["rh"],
            evento="incidencia_registrada",
            datos={"incidencia_id": incidencia.id, "empleado_id": empleado_id}
        )
        await db.commit()
        return incidencia

    async def adjuntar_evidencia(
        self,
        db: AsyncSession,
        incidencia_id: int,
        archivo_path: str,
        nombre_original: str,
        mime_type: str,
        tamano_bytes: int,
        actor: Empleado,
    ) -> Evidencia:
        incidencia = await IncidenciaRepository(db).get_by_id(incidencia_id)

        # CB-104
        if incidencia.estado == "closed":
            raise HTTPException(409, "No se pueden adjuntar evidencias a una incidencia cerrada")

        # RN-103
        MIME_PERMITIDOS = {
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg", "image/png", "video/mp4"
        }
        if mime_type not in MIME_PERMITIDOS:
            raise HTTPException(422, "Tipo de archivo no permitido")
        if tamano_bytes > 52_428_800:
            raise HTTPException(422, "El archivo excede el limite de 50MB")

        evidencia = Evidencia(
            entidad_tipo="incidencia",
            entidad_id=incidencia_id,
            archivo_path=archivo_path,
            nombre_original=nombre_original,
            mime_type=mime_type,
            tamano_bytes=tamano_bytes,
            subido_por=actor.id,
            activo=True,
        )
        db.add(evidencia)
        await db.flush()

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="adjuntar_evidencia",
            modulo="incidencias", entidad_id=incidencia_id,
            datos_despues={"evidencia_id": evidencia.id, "nombre": nombre_original}
        )
        await db.commit()
        return evidencia

    async def cambiar_estado(
        self,
        db: AsyncSession,
        incidencia_id: int,
        nuevo_estado: str,
        actor: Empleado,
    ) -> Incidencia:
        FLUJO = {"open": "in_review", "in_review": "resolved", "resolved": "closed"}
        incidencia = await IncidenciaRepository(db).get_by_id(incidencia_id)

        # RN-107: transicion valida
        if FLUJO.get(incidencia.estado) != nuevo_estado:
            raise HTTPException(409, f"Transicion invalida: {incidencia.estado} → {nuevo_estado}")

        # Validaciones por transicion destino
        if nuevo_estado == "in_review":
            # RN-105
            if actor.rol.nombre not in ("rh", "gerente"):
                raise HTTPException(403, "Solo RH o gerente pueden mover a IN_REVIEW")
            tiene_evidencia = await EvidenciaRepository(db).existe_evidencia_activa(
                "incidencia", incidencia_id
            )
            if not tiene_evidencia:
                raise HTTPException(422, "Debe adjuntar al menos una evidencia antes de mover a revision")

        elif nuevo_estado == "resolved":
            if actor.rol.nombre not in ("rh", "gerente"):
                raise HTTPException(403, "Solo RH o gerente pueden resolver una incidencia")

        elif nuevo_estado == "closed":
            # RN-106
            if actor.rol.nombre != "rh":
                raise HTTPException(403, "Solo RH puede cerrar una incidencia")

        datos_antes = {"estado": incidencia.estado}
        incidencia.estado = nuevo_estado

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion=f"incidencia_{nuevo_estado}",
            modulo="incidencias", entidad_id=incidencia.id,
            datos_antes=datos_antes, datos_despues={"estado": nuevo_estado}
        )

        # RN-110: encolar TRESS si aplica
        if nuevo_estado == "closed" and incidencia.tipo in ("falta", "retardo"):
            empleado = await EmpleadoRepository(db).get_by_id(incidencia.empleado_id)
            tress_item = TressRobotQueue(
                accion="registrar_incidencia_nomina",
                payload={
                    "incidencia_id": incidencia.id,
                    "empleado_num": empleado.num_empleado,
                    "tipo": incidencia.tipo,
                    "fecha": str(incidencia.created_at.date()),
                },
                estado="pending",
                intentos=0,
            )
            db.add(tress_item)

        await NotificacionService.notificar(
            destinatarios=[incidencia.empleado_id],
            evento=f"incidencia_{nuevo_estado}",
            datos={"incidencia_id": incidencia.id}
        )
        await db.commit()
        return incidencia
```

### Notificaciones disparadas

| Evento | Canal | Destinatarios |
|---|---|---|
| Incidencia registrada | in-app | RH |
| Incidencia → IN_REVIEW | in-app | Empleado afectado, RH |
| Incidencia → RESOLVED | in-app + email | Empleado afectado |
| Incidencia → CLOSED | in-app + email | Empleado afectado, supervisor que registro |

---

## FLUJO 3 — Actas Administrativas (con IA Ollama)

### Diagrama de estados

```
        [RH genera acta desde incidencia o manualmente]
                           |
              Ollama disponible?
             /                \
           SI                  NO (timeout >30s o down)
           |                    |
    contenido_ia=<borrador>  contenido_ia=NULL
           \                  /
            +--------+-------+
                     |
                     v
                  +-------+
                  | DRAFT |<--- RH puede editar contenido_final
                  +-------+     multiples veces; estado no cambia
                     |
           RH envia a firma
                     |
                     v
             +--------------+
             | PENDING_SIGN |  Notificar: gerente + director + rh
             +--------------+  (3 ActaAprobacion creados con firma_timestamp=NULL)
                     |
        Cada firmante firma independientemente
        (cualquier orden; sin SLA forzado)
                     |
        Cuando los 3 tienen firma_timestamp != NULL
                     |
                     v
                  +--------+
                  | SIGNED |  Generar PDF automaticamente
                  +--------+
                     |
                     v  (inmediato, mismo flujo)
                  +----------+
                  | ARCHIVED |  Vincular a expediente del empleado
                  +----------+    (estado final)
```

### Tabla de transiciones

| Actor | Accion | Estado anterior | Estado nuevo | Condicion | Side effects |
|---|---|---|---|---|---|
| rh | generar acta | — | DRAFT | actor.rol==rh; incidencia_id valido O acta manual | Llamar Ollama (timeout 30s); si timeout: contenido_ia=NULL; crear ActaAprobacion x3 (firma_timestamp=NULL); audit_log |
| rh | editar borrador | DRAFT | DRAFT | actor.rol==rh; estado==draft | UPDATE contenido_final; audit_log |
| rh | enviar a firma | DRAFT | PENDING_SIGN | actor.rol==rh; contenido_final NOT NULL AND NOT EMPTY | Notificar gerente + director + rh; audit_log |
| gerente / director / rh | firmar | PENDING_SIGN | PENDING_SIGN o SIGNED | firmante tiene ActaAprobacion con firma_timestamp NULL; firmante activo | SET firma_timestamp=now(); if 3/3 firmados: → SIGNED |
| sistema | auto-archivar | SIGNED | ARCHIVED | triggered al llegar a SIGNED | Generar PDF; vincular expediente; audit_log |

### Reglas de negocio

**Generacion**
- RN-201: Solo empleados con rol `rh` pueden generar un acta administrativa.
- RN-202: Si se provee `incidencia_id`, la incidencia debe existir y estar en estado `in_review`, `resolved` o `closed`. No se puede generar acta de una incidencia OPEN.
- RN-203: Se permiten multiples actas para la misma incidencia. No hay restriccion de unicidad. Cada acta es un documento independiente.
- RN-204: Un acta puede generarse sin `incidencia_id` (acta manual). `incidencia_id` es nullable en el modelo.

**Ollama**
- RN-205: Al generar el acta, se llama a Ollama con timeout de 30 segundos. El prompt incluye: nombre del empleado, tipo de incidencia, fecha, descripcion, lista de evidencias.
- RN-206: Si Ollama no responde en 30 segundos o retorna error: `contenido_ia = NULL`, `contenido_final = NULL`. El acta se crea en estado DRAFT con ambos campos vacios. RH debe redactar manualmente.
- RN-207: Si Ollama responde correctamente: `contenido_ia = <texto generado>`, `contenido_final = <texto generado>` (copia inicial editable).

**Edicion**
- RN-208: RH puede editar `contenido_final` mientras el estado sea DRAFT. Cada edicion registra en audit_log el contenido anterior y el nuevo.
- RN-209: Una vez en PENDING_SIGN, el contenido es inmutable. No se puede editar ni regresar a DRAFT. Si RH necesita editar, debe generar un nuevo acta.

**Firmas**
- RN-210: Al enviar a firma (DRAFT → PENDING_SIGN), se crean 3 registros en `acta_aprobaciones`: uno por cada firmante requerido (gerente, director, rh), con `firma_timestamp = NULL`.
- RN-211: La identificacion del firmante especifico (que gerente, que director) la resuelve el sistema al momento de envio a firma, tomando los empleados activos con esos roles. **Supuesto:** hay exactamente un director y un rh activos en el sistema. Para gerente: se toma el gerente del departamento del empleado afectado; si no hay gerente de departamento, tomar cualquier gerente activo.
- RN-212: El orden de firmas no importa. Cualquier firmante puede firmar en cualquier momento mientras el estado sea PENDING_SIGN.
- RN-213: Un firmante solo puede firmar una vez por acta. Intentar firmar dos veces retorna HTTP 409.
- RN-214: Cuando los 3 firmantes tienen `firma_timestamp IS NOT NULL`: el sistema transiciona automaticamente a SIGNED, genera el PDF y luego a ARCHIVED, todo en la misma transaccion.
- RN-215: Si un firmante es desactivado despues de enviar a firma: RH debe intervenir manualmente para reasignar o sustituir al firmante. El sistema expone un endpoint de sustitucion de firmante (rol rh requerido) que actualiza el `firmante_id` en `acta_aprobaciones` y notifica al nuevo firmante.

**Auditoria**
- RN-216: Toda accion sobre un acta (creacion, edicion, firma, generacion PDF) se registra en `audit_log` con `modulo='actas'`.

### Casos borde y manejo

- **CB-201: Acta generada sin incidencia previa (manual).**
  Comportamiento: Permitido. `incidencia_id = NULL`. Se crea normalmente con los mismos estados y flujo.

- **CB-202: Ollama tarda mas de 30 segundos.**
  Comportamiento: `asyncio.wait_for(ollama_call(), timeout=30.0)` — si `asyncio.TimeoutError`: `contenido_ia = NULL`, el acta se crea en DRAFT. Se registra en audit_log `accion='ollama_timeout'`. RH ve una alerta en la UI indicando que la IA no respondio.

- **CB-203: Intento de editar acta en PENDING_SIGN.**
  Comportamiento: HTTP 409, mensaje: "El acta ya fue enviada a firma y no puede editarse. Genere un nuevo acta si necesita modificaciones".

- **CB-204: Firmante desactivado antes de firmar.**
  Comportamiento: El sistema no bloquea automaticamente — el acta permanece en PENDING_SIGN. RH recibe una notificacion al detectar la desactivacion del firmante (via IT sync). RH usa endpoint de sustitucion para asignar nuevo firmante.

- **CB-205: Intento de firmar dos veces.**
  Comportamiento: HTTP 409, mensaje: "Ya has firmado este acta".

- **CB-206: Multiples actas sobre la misma incidencia.**
  Comportamiento: Permitido. Cada acta tiene su propio ciclo de vida independiente. Se recomienda que la UI muestre advertencia: "Ya existe un acta para esta incidencia", pero no bloquear.

- **CB-207: RH intenta enviar a firma con `contenido_final` vacio.**
  Comportamiento: HTTP 422, mensaje: "El contenido del acta no puede estar vacio antes de enviar a firma".

- **CB-208: Que gerente firma si hay multiples gerentes activos?**
  Comportamiento: El sistema asigna al gerente del mismo departamento que el empleado afectado (`empleado.departamento`). Si no hay gerente para ese departamento, se asigna al primer gerente activo encontrado, con notificacion a RH de la asignacion manual.

### Pseudocodigo del Service

```python
class ActaService:

    async def generar_acta(
        self,
        db: AsyncSession,
        incidencia_id: int | None,
        empleado_id: int,
        actor: Empleado,
    ) -> ActaAdministrativa:
        # RN-201
        if actor.rol.nombre != "rh":
            raise HTTPException(403, "Solo RH puede generar actas administrativas")

        # RN-202
        if incidencia_id is not None:
            incidencia = await IncidenciaRepository(db).get_by_id(incidencia_id)
            if not incidencia:
                raise HTTPException(404, "Incidencia no encontrada")
            if incidencia.estado == "open":
                raise HTTPException(422, "No se puede generar acta de una incidencia en estado OPEN")

        # RN-205 / RN-206: llamar Ollama con timeout
        contenido_ia = None
        try:
            prompt_data = await self._build_ollama_prompt(db, empleado_id, incidencia_id)
            contenido_ia = await asyncio.wait_for(
                OllamaClient.generar_acta(prompt_data),
                timeout=30.0
            )
        except (asyncio.TimeoutError, OllamaError):
            # RN-206: fallback manual
            contenido_ia = None
            await AuditLogger.log_action(
                db, usuario_id=actor.id, accion="ollama_timeout",
                modulo="actas", entidad_id=None, datos_despues={"incidencia_id": incidencia_id}
            )

        acta = ActaAdministrativa(
            incidencia_id=incidencia_id,
            empleado_id=empleado_id,
            contenido_ia=contenido_ia,
            contenido_final=contenido_ia,  # copia inicial editable; NULL si Ollama fallo
            estado="draft",
            generado_por=actor.id,
        )
        db.add(acta)
        await db.flush()

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="generar_acta",
            modulo="actas", entidad_id=acta.id,
            datos_despues={"estado": "draft", "ollama_ok": contenido_ia is not None}
        )
        await db.commit()
        return acta

    async def editar_borrador(
        self,
        db: AsyncSession,
        acta_id: int,
        contenido_final: str,
        actor: Empleado,
    ) -> ActaAdministrativa:
        acta = await ActaRepository(db).get_by_id(acta_id)

        if actor.rol.nombre != "rh":
            raise HTTPException(403, "Solo RH puede editar el borrador")

        # RN-209
        if acta.estado != "draft":
            raise HTTPException(409, "El acta ya fue enviada a firma y no puede editarse")

        datos_antes = {"contenido_final": acta.contenido_final}
        acta.contenido_final = contenido_final

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="editar_borrador",
            modulo="actas", entidad_id=acta.id,
            datos_antes=datos_antes, datos_despues={"contenido_final": contenido_final[:200]}
        )
        await db.commit()
        return acta

    async def enviar_a_firma(
        self,
        db: AsyncSession,
        acta_id: int,
        actor: Empleado,
    ) -> ActaAdministrativa:
        acta = await ActaRepository(db).get_by_id(acta_id)

        if actor.rol.nombre != "rh":
            raise HTTPException(403, "Solo RH puede enviar a firma")
        if acta.estado != "draft":
            raise HTTPException(409, "Solo actas en DRAFT pueden enviarse a firma")

        # CB-207
        if not acta.contenido_final or not acta.contenido_final.strip():
            raise HTTPException(422, "El contenido del acta no puede estar vacio")

        # RN-210: resolver firmantes
        firmantes = await self._resolver_firmantes(db, acta.empleado_id)
        # firmantes = [{"id": <empleado_id>, "rol": "gerente"}, ...]

        for firmante in firmantes:
            aprobacion = ActaAprobacion(
                acta_id=acta.id,
                firmante_id=firmante["id"],
                rol_firmante=firmante["rol"],
                firma_timestamp=None,
            )
            db.add(aprobacion)

        acta.estado = "pending_sign"
        await db.flush()

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="enviar_a_firma",
            modulo="actas", entidad_id=acta.id,
            datos_antes={"estado": "draft"}, datos_despues={"estado": "pending_sign"}
        )
        await NotificacionService.notificar(
            destinatarios=[f["id"] for f in firmantes],
            evento="acta_pendiente_firma",
            datos={"acta_id": acta.id}
        )
        await db.commit()
        return acta

    async def firmar(
        self,
        db: AsyncSession,
        acta_id: int,
        actor: Empleado,
        comentario: str | None,
    ) -> ActaAdministrativa:
        acta = await ActaRepository(db).get_by_id(acta_id)

        if acta.estado != "pending_sign":
            raise HTTPException(409, "El acta no esta en estado de firma")

        # Buscar la aprobacion pendiente del firmante
        aprobacion = await ActaAprobacionRepository(db).get_pendiente(acta_id, actor.id)
        if not aprobacion:
            raise HTTPException(403, "No eres firmante de este acta o no tienes firma pendiente")

        # RN-213: no firmar dos veces
        if aprobacion.firma_timestamp is not None:
            raise HTTPException(409, "Ya has firmado este acta")

        aprobacion.firma_timestamp = datetime.now(timezone.utc)
        aprobacion.comentario = comentario

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="firmar_acta",
            modulo="actas", entidad_id=acta.id,
            datos_despues={"firmante_id": actor.id, "rol": actor.rol.nombre}
        )

        # RN-214: verificar si todos firmaron
        total_firmantes = await ActaAprobacionRepository(db).count_total(acta_id)
        total_firmados = await ActaAprobacionRepository(db).count_firmados(acta_id)

        if total_firmados + 1 >= total_firmantes:  # +1 por la firma actual (aun no commiteada)
            acta.estado = "signed"
            await self._generar_pdf_y_archivar(db, acta)

        await db.commit()
        return acta

    async def _generar_pdf_y_archivar(
        self, db: AsyncSession, acta: ActaAdministrativa
    ) -> None:
        """RN-214: Generar PDF y archivar en la misma transaccion."""
        # Llamar a PdfService (implementacion pendiente)
        pdf_path = await PdfService.generar_acta_pdf(acta)
        acta.estado = "archived"
        # Vincular al expediente del empleado
        await ExpedienteService.vincular_acta(db, acta.empleado_id, acta.id, pdf_path)
        await AuditLogger.log_action(
            db, usuario_id=None, accion="acta_archivada",
            modulo="actas", entidad_id=acta.id,
            datos_despues={"estado": "archived", "pdf_path": pdf_path}
        )

    async def _resolver_firmantes(
        self, db: AsyncSession, empleado_id: int
    ) -> list[dict]:
        """RN-211: Resolver los 3 firmantes concretos."""
        empleado = await EmpleadoRepository(db).get_by_id(empleado_id)
        firmantes = []

        # Director: unico activo
        director = await EmpleadoRepository(db).get_activo_por_rol("director")
        firmantes.append({"id": director.id, "rol": "director"})

        # RH: unico activo (o el que ejecuta la accion)
        rh = await EmpleadoRepository(db).get_activo_por_rol("rh")
        firmantes.append({"id": rh.id, "rol": "rh"})

        # Gerente: del departamento del empleado
        gerente = await EmpleadoRepository(db).get_gerente_por_departamento(
            empleado.departamento
        )
        if not gerente:
            gerente = await EmpleadoRepository(db).get_primer_activo_por_rol("gerente")
            await NotificacionService.notificar(
                destinatarios=["rh"],
                evento="asignacion_gerente_manual",
                datos={"acta_empleado_id": empleado_id, "gerente_asignado_id": gerente.id}
            )
        firmantes.append({"id": gerente.id, "rol": "gerente"})

        return firmantes
```

### Notificaciones disparadas

| Evento | Canal | Destinatarios |
|---|---|---|
| Acta generada | in-app | RH (confirmacion) |
| Ollama timeout | in-app (alerta) | RH |
| Acta enviada a firma | in-app + email | Gerente, Director, RH |
| Acta firmada (parcial) | in-app | RH (seguimiento) |
| Acta firmada (completa — SIGNED) | in-app + email | Empleado afectado, RH |
| Firmante desactivado | in-app (alerta) | RH |
| Gerente asignado manualmente | in-app (alerta) | RH |

---

## FLUJO 4 — Comedor + Lector de Huella

### Diagrama de estados (por empleado por semana)

```
   Inicio de semana (lunes)
           |
           v
   +----------------+
   | NO_REGISTRADO  |  Estado inicial para toda semana nueva
   +----------------+
           |
   Empleado selecciona tipo_platillo
   (antes del corte: domingo 23:59)
           |
           v
   +------------+
   | REGISTRADO |
   +------------+
           |
      Empleado acerca
      huella al lector
           |
    Sistema disponible?
   /                   \
  SI                    NO (timeout >500ms o sistema caido)
  |                      |
 Registro en BD         FAIL OPEN
 acceso_concedido=True  acceso_concedido=True
 huella_timestamp=now() huella_timestamp=now() (timestamp del lector)
  |                      |
  +----------+----------+
             |
             v
         +--------+
         | ACCEDIO |
         +--------+

Si el empleado NO registra antes del corte:
   NO_REGISTRADO ──> lector envia POST ──> sistema responde {acceso: false}
                     PERO si sistema caido: FAIL OPEN (acceso true de todas formas)

Estado NO_ACCEDIO: se asigna al final de la semana a todos los REGISTRADO
que nunca activaron su huella.
```

### Tabla de transiciones

| Actor | Accion | Estado anterior | Estado nuevo | Condicion | Side effects |
|---|---|---|---|---|---|
| rh | cargar menu semanal | — | menu publicado | actor.rol==rh; fecha carga < lunes de la semana objetivo | Crear MenuSemanal por dia; audit_log; notificar empleados |
| empleado | registrar seleccion | NO_REGISTRADO | REGISTRADO | empleado.activo==True; timestamp < domingo 23:59 de la semana; no existe registro previo para esa semana/comedor | Crear ComedorRegistro con acceso_concedido=False, huella_timestamp=NULL; audit_log |
| lector (sistema) | validar huella | REGISTRADO | ACCEDIO | IP en HUELLA_WHITELIST_IPS; empleado encontrado por huella_id; respuesta en <500ms | SET acceso_concedido=True, huella_timestamp=payload.timestamp; audit_log |
| lector (sistema) | validar huella (fail open) | cualquiera | ACCEDIO | sistema no responde en 500ms O sistema caido | Lector concede acceso; cuando sistema vuelva: registrar intento con acceso_concedido=True y nota "fail_open" |
| rh | registro manual | NO_REGISTRADO | REGISTRADO | actor.rol==rh; semana en curso o futura | Crear ComedorRegistro como si fuera el empleado; audit_log con nota "registro_manual_rh" |
| sistema (cron) | cerrar semana | REGISTRADO | NO_ACCEDIO | fin de semana (domingo 23:59) y acceso_concedido==False | Marcar registros no accedidos; audit_log |

### Reglas de negocio

**Menu**
- RN-401: RH debe cargar el menu semanal antes del lunes de la semana objetivo. Si el menu no existe para una semana, los empleados no pueden registrar seleccion para esa semana (rechazar con HTTP 422).
- RN-402: El menu se carga por dia de la semana y tipo (normal/dieta). Puede incluir foto (`foto_path`).

**Registro de seleccion**
- RN-403: El corte para registro de seleccion es el domingo a las 23:59 de la semana anterior a la semana de servicio. **PENDIENTE DE CONFIRMACION CON LEONI.** Esta regla debe ser configurable via variable de entorno o tabla de configuracion, no hardcodeada.
- RN-404: Un empleado solo puede tener un registro activo por semana por comedor. Intentar registrar dos veces retorna HTTP 409.
- RN-405: El empleado no puede cambiar su seleccion despues del corte. RH puede hacer cambio excepcional con registro en audit_log.
- RN-406: Solo empleados con `activo=True` pueden registrar seleccion.

**Validacion de huella**
- RN-407: Solo peticiones provenientes de IPs listadas en `HUELLA_WHITELIST_IPS` (variable de entorno, lista separada por comas) pueden llamar `/api/v1/comedor/huella/validar`. Peticiones de IPs no autorizadas retornan HTTP 403.
- RN-408: El sistema debe responder en maximo 500ms. Si la logica interna supera 450ms, retornar inmediatamente con `{acceso: true, empleado: "TIMEOUT_FALLBACK", tipo_platillo: "N/A"}` para garantizar el margen.
- RN-409: FAIL OPEN se aplica en exactamente estos escenarios: (a) el endpoint no responde en 500ms segun el lector, (b) el lector no puede conectar con el servidor (connection refused/timeout de red). En ambos casos, el lector concede acceso por defecto segun politica Leoni.
- RN-410: El `huella_id` en el payload identifica al empleado. Debe existir un mapeo `huella_id → empleado_id` en el sistema. **Supuesto:** existe una tabla `empleado_huellas` o el campo `huella_id` esta en la tabla de empleados. **PENDIENTE DE CONFIRMACION** — el modelo actual de `Empleado` no tiene este campo.
- RN-411: Si el `huella_id` no se encuentra en el sistema: retornar `{acceso: false, empleado: null, tipo_platillo: null}` y registrar en `comedor_registros` con `acceso_concedido=False` y nota en audit_log.
- RN-412: Un empleado tiene UN acceso por semana. Si el sistema detecta que `ComedorRegistro` para esa semana ya tiene `acceso_concedido=True`: retornar `{acceso: false}` con mensaje "Acceso ya utilizado esta semana". Registrar el intento en audit_log.
- RN-413: Toda llamada al endpoint (exitosa o fallida) se registra en `comedor_registros` y en `audit_log` con `modulo='comedor'`, incluyendo `huella_timestamp` del payload del lector.

**Datos**
- RN-414: El campo `huella_timestamp` en `comedor_registros` almacena el timestamp exacto del acceso fisico reportado por el lector, no el timestamp del servidor. Esto permite auditoria precisa de cuando el empleado accedio fisicamente.

### Casos borde y manejo

- **CB-401: Empleado sin registro intenta acceder (NO_REGISTRADO).**
  Comportamiento cuando sistema esta UP: `{acceso: false, empleado: nombre, tipo_platillo: null}`. Registrar intento con `acceso_concedido=False`. No crear `ComedorRegistro` nuevo — solo audit_log.
  Comportamiento cuando sistema esta DOWN: FAIL OPEN por politica Leoni. El lector concede acceso.

- **CB-402: Empleado intenta cambiar seleccion despues del corte.**
  Comportamiento: HTTP 409 para el empleado. Solo RH puede forzar el cambio via endpoint administrativo con registro en audit_log.

- **CB-403: Empleado intenta acceder dos veces en la misma semana.**
  Comportamiento: Sistema UP → `{acceso: false}`, registrar intento en audit_log. Sistema DOWN → FAIL OPEN (segundo acceso permitido por politica).

- **CB-404: `huella_id` no registrado en el sistema.**
  Comportamiento: `{acceso: false, empleado: null, tipo_platillo: null}`. Registrar en audit_log con `accion='huella_desconocida'`. Notificar a RH si ocurre frecuentemente (umbral a definir).

- **CB-405: RH olvidó cargar el menu antes del lunes.**
  Comportamiento: El endpoint de registro de seleccion retorna HTTP 422 con mensaje "Menu no disponible para esta semana". RH es notificado. Si el menu no existe pero el lector envia validaciones: retornar `{acceso: false}` para todos (sistema UP) o FAIL OPEN (sistema DOWN).

- **CB-406: IP del lector no esta en whitelist.**
  Comportamiento: HTTP 403 inmediato. Registrar en audit_log con `accion='acceso_ip_no_autorizada'` y la IP intentada.

### Pseudocodigo del Service

```python
class ComedorService:

    async def registrar_seleccion(
        self,
        db: AsyncSession,
        comedor_id: int,
        semana: date,
        tipo_platillo: str,
        actor: Empleado,
    ) -> ComedorRegistro:
        # RN-406
        if not actor.activo:
            raise HTTPException(422, "Empleado inactivo")

        # RN-401: verificar que existe menu para la semana
        menu_existe = await MenuRepository(db).existe_menu_semana(comedor_id, semana)
        if not menu_existe:
            raise HTTPException(422, "Menu no disponible para esta semana")

        # RN-403: verificar corte
        corte = self._calcular_corte(semana)  # domingo anterior 23:59
        if datetime.now(timezone.utc) > corte:
            raise HTTPException(409, "El periodo de registro para esta semana ha cerrado")

        # RN-404: un registro por semana
        ya_registrado = await ComedorRegistroRepository(db).existe_registro(
            actor.id, comedor_id, semana
        )
        if ya_registrado:
            raise HTTPException(409, "Ya tienes un registro para esta semana en este comedor")

        registro = ComedorRegistro(
            empleado_id=actor.id,
            comedor_id=comedor_id,
            semana=semana,
            tipo_platillo=tipo_platillo,
            acceso_concedido=False,
            huella_timestamp=None,
        )
        db.add(registro)
        await db.flush()

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="registrar_seleccion_comedor",
            modulo="comedor", entidad_id=registro.id,
            datos_despues={"semana": str(semana), "tipo_platillo": tipo_platillo}
        )
        await db.commit()
        return registro

    async def validar_huella(
        self,
        db: AsyncSession,
        huella_id: str,
        comedor_id: int,
        timestamp: datetime,
        request_ip: str,
    ) -> HuellaValidarResponse:
        # RN-407: whitelist IP — validado en middleware/dependency antes de llegar al service
        # (ver dependency check_huella_ip)

        # RN-410: resolver empleado por huella_id
        empleado = await EmpleadoRepository(db).get_by_huella_id(huella_id)

        if not empleado:
            # CB-404: huella desconocida
            await AuditLogger.log_action(
                db, usuario_id=None, accion="huella_desconocida",
                modulo="comedor", entidad_id=None,
                datos_despues={"huella_id": huella_id, "comedor_id": comedor_id, "ip": request_ip}
            )
            await db.commit()
            return HuellaValidarResponse(acceso=False, empleado=None, tipo_platillo=None)

        semana_actual = self._get_semana_actual()

        # RN-412: verificar acceso previo en la semana
        registro = await ComedorRegistroRepository(db).get_registro_semana(
            empleado.id, comedor_id, semana_actual
        )

        if not registro:
            # CB-401: sin registro
            await AuditLogger.log_action(
                db, usuario_id=empleado.id, accion="acceso_sin_registro",
                modulo="comedor", entidad_id=None,
                datos_despues={"semana": str(semana_actual), "huella_timestamp": str(timestamp)}
            )
            await db.commit()
            return HuellaValidarResponse(
                acceso=False,
                empleado=f"{empleado.nombre} {empleado.apellido}",
                tipo_platillo=None
            )

        if registro.acceso_concedido:
            # CB-403: acceso duplicado
            await AuditLogger.log_action(
                db, usuario_id=empleado.id, accion="acceso_duplicado",
                modulo="comedor", entidad_id=registro.id,
                datos_despues={"huella_timestamp": str(timestamp)}
            )
            await db.commit()
            return HuellaValidarResponse(
                acceso=False,
                empleado=f"{empleado.nombre} {empleado.apellido}",
                tipo_platillo=registro.tipo_platillo
            )

        # Acceso valido — registrar
        registro.acceso_concedido = True
        registro.huella_timestamp = timestamp  # RN-414: timestamp del lector, no del servidor

        await AuditLogger.log_action(
            db, usuario_id=empleado.id, accion="acceso_comedor_concedido",
            modulo="comedor", entidad_id=registro.id,
            datos_despues={
                "huella_timestamp": str(timestamp),
                "tipo_platillo": registro.tipo_platillo
            }
        )
        await db.commit()

        return HuellaValidarResponse(
            acceso=True,
            empleado=f"{empleado.nombre} {empleado.apellido}",
            tipo_platillo=registro.tipo_platillo
        )

    def _calcular_corte(self, semana: date) -> datetime:
        """Domingo 23:59:59 de la semana anterior a 'semana' (que es el lunes)."""
        lunes = semana
        domingo_anterior = lunes - timedelta(days=1)
        return datetime(
            domingo_anterior.year, domingo_anterior.month, domingo_anterior.day,
            23, 59, 59, tzinfo=timezone.utc
        )

    def _get_semana_actual(self) -> date:
        """Retorna el lunes de la semana en curso."""
        hoy = date.today()
        return hoy - timedelta(days=hoy.weekday())
```

**Dependency para whitelist IP (FastAPI):**
```python
async def check_huella_ip(request: Request) -> None:
    whitelist_raw = settings.HUELLA_WHITELIST_IPS  # "192.168.1.10,192.168.1.11"
    whitelist = [ip.strip() for ip in whitelist_raw.split(",")]
    client_ip = request.client.host
    if client_ip not in whitelist:
        await AuditLogger.log_action_sync(
            accion="acceso_ip_no_autorizada",
            modulo="comedor",
            datos_despues={"ip": client_ip}
        )
        raise HTTPException(403, "IP no autorizada")
```

### Notificaciones disparadas

| Evento | Canal | Destinatarios |
|---|---|---|
| Menu semanal publicado | in-app + email | Todos los empleados activos |
| Corte de registro proximo (24h antes) | in-app | Empleados sin registro |
| Acceso concedido | (sin notificacion — solo registro) | — |
| Huella desconocida (recurrente) | in-app (alerta) | RH |
| Menu no cargado a tiempo | in-app (alerta) | RH |

---

## FLUJO 5 — Sincronizacion IT Mirror

### Diagrama de estados (por registro de empleado)

```
  Fuente de verdad: BD IT (externa)
  Destino: BD local plataforma RH

  Cada 30 minutos:
  APScheduler → ITSyncJob.ejecutar()
       |
       +-- Para cada empleado en BD IT:
       |       |
       |   Existe en BD local?
       |   /              \
       |  NO               SI
       |  |                |
       | INSERT           Datos cambiaron?
       |  |               /         \
       |  v              SI          NO
       | Empleado        |            |
       | creado         UPDATE       Skip
       |                |
       |           activo pasó a False?
       |               /     \
       |             SI       NO
       |             |        |
       |          DEACTIVATE  UPDATE normal
       |             |
       |    Cancelar solicitudes PENDING
       |    Notificar RH
       |
       +-- Registrar en it_sync_log (ok/error por cada operacion)
```

### Tabla de transiciones

| Actor | Accion | Estado anterior | Estado nuevo | Condicion | Side effects |
|---|---|---|---|---|---|
| sistema (APScheduler) | INSERT nuevo empleado | — | activo=True | num_empleado no existe en BD local | Crear Empleado; NO crear credenciales — asignar password_hash temporal; audit_log; notificar RH para completar perfil (rol_id, supervisor_id) |
| sistema (APScheduler) | UPDATE datos | activo=True | activo=True | num_empleado existe; datos difieren en campos sincronizables | Actualizar campos IT; NO tocar: rol_id, supervisor_id, password_hash; audit_log |
| sistema (APScheduler) | DEACTIVATE | activo=True | activo=False | activo=False en IT | soft delete; cancelar solicitudes PENDING; notificar RH; audit_log |
| sistema (APScheduler) | skip | sin cambio | sin cambio | datos identicos | Solo registrar timestamp de verificacion en it_sync_log |

### Reglas de negocio

**Campos sincronizables desde IT**
- RN-501: Los siguientes campos se sincronizan desde IT y pueden sobreescribirse: `num_empleado`, `nombre`, `apellido`, `email`, `departamento`, `puesto`, `activo`, `fecha_ingreso`.
- RN-502: Los siguientes campos son exclusivos de la plataforma RH y NUNCA se sobreescriben por el sync: `rol_id`, `supervisor_id`, `password_hash`, `created_at`.

**Integridad**
- RN-503: El identificador estable de sincronizacion es `num_empleado`. El `id` interno de la plataforma es autoincremental y no se expone a IT.
- RN-504: Si el sync detecta un `num_empleado` que existia y ha cambiado en IT (es decir, IT retira el numero y lo reasigna): tratar como INSERT nuevo + DEACTIVATE del anterior. Emitir alerta a RH — este caso indica un problema de datos en IT.
- RN-505: Si se detecta conflicto de email (email en IT ya existe en BD local pero asociado a diferente `num_empleado`): NO actualizar. Registrar en `it_sync_log` con `status='error'` y `error_msg='email_conflict'`. Notificar a RH para resolucion manual.

**Empleado nuevo**
- RN-506: Al crear un empleado nuevo via sync: asignar `rol_id` al rol `empleado` por defecto. Asignar `password_hash` como hash de `num_empleado` (contrasena temporal que RH debe cambiar). Notificar a RH para completar `supervisor_id` y ajustar `rol_id` si aplica.

**Baja de empleado**
- RN-507: Al desactivar un empleado (`activo=False`): ejecutar en la misma transaccion: `UPDATE solicitudes SET estado='cancelled' WHERE empleado_id=X AND estado='pending'`. Registrar la cancelacion en audit_log con `usuario_id=NULL` (accion de sistema).
- RN-508: Las solicitudes en estado `approved`, `rejected`, `cancelled` no se modifican al dar de baja al empleado — son registros historicos.

**Auditoria**
- RN-509: Cada operacion (insert, update, deactivate, skip) se registra en `it_sync_log` con `operacion`, `empleado_id` (num_empleado como string), `datos` (payload JSON), `status`, `error_msg`.
- RN-510: Cada escritura en `empleados` tambien se registra en `audit_log` con `modulo='it_sync'` y `usuario_id=NULL`.

**Resiliencia**
- RN-511: Si una operacion individual falla (error de constraint, timeout, etc.), el sync NO aborta todo el lote. Registra el error en `it_sync_log` para ese empleado y continua con los demas.
- RN-512: Si la BD IT no esta disponible al iniciar el sync: registrar un `it_sync_log` con `status='error'` y `error_msg='bd_it_unavailable'`. No ejecutar ninguna operacion. Notificar a RH.

### Casos borde y manejo

- **CB-501: Empleado con solicitudes PENDING es dado de baja.**
  Comportamiento: En la misma transaccion del DEACTIVATE: cancelar todas las solicitudes PENDING del empleado. Registrar en audit_log. Notificar a RH con la lista de solicitudes canceladas.

- **CB-502: num_empleado cambia en IT.**
  Comportamiento: El sistema no puede detectar automaticamente que es el mismo empleado fisico con numero diferente. Tratar como: (a) DEACTIVATE del registro con el numero antiguo, (b) INSERT del registro con el numero nuevo. Emitir alerta critica a RH para que transfiera expediente y solicitudes históricas manualmente.

- **CB-503: Conflicto de email.**
  Comportamiento: Saltar la operacion de UPDATE para ese empleado. Registrar en `it_sync_log` con `status='error'`, `error_msg='email_conflict: email X ya existe para num_empleado Y'`. Notificar a RH via in-app con prioridad alta.

- **CB-504: BD IT no disponible.**
  Comportamiento: El APScheduler registra el intento fallido. Intentara de nuevo en 30 minutos (siguiente ciclo normal). No hay reintento inmediato. Si 3 ciclos consecutivos fallan: notificar al equipo IT (canal a definir).

- **CB-505: Empleado reactivado en IT (activo False → True).**
  Comportamiento: El sync detecta el cambio y ejecuta UPDATE `activo=True`. No hay otro side effect automatico — las solicitudes canceladas previamente permanecen canceladas. RH recibe notificacion de reactivacion.

### Pseudocodigo del Service

```python
class ITSyncService:

    async def ejecutar_sync(self, db: AsyncSession) -> dict:
        """Cron job ejecutado cada 30 minutos por APScheduler."""
        stats = {"insert": 0, "update": 0, "deactivate": 0, "skip": 0, "error": 0}

        # RN-512: verificar disponibilidad de BD IT
        try:
            empleados_it = await ITReadRepository.get_all_empleados()
        except Exception as e:
            await ItSyncLog.registrar(
                db, operacion="insert", empleado_id="N/A",
                status="error", error_msg=f"bd_it_unavailable: {str(e)}"
            )
            await NotificacionService.notificar(
                destinatarios=["rh"], evento="it_sync_fallo",
                datos={"error": "BD IT no disponible"}
            )
            await db.commit()
            return stats

        for emp_it in empleados_it:
            try:
                resultado = await self._procesar_empleado(db, emp_it)
                stats[resultado] += 1
            except Exception as e:
                # RN-511: error individual no aborta el lote
                await ItSyncLog.registrar(
                    db, operacion="update", empleado_id=emp_it["num_empleado"],
                    datos=emp_it, status="error", error_msg=str(e)
                )
                stats["error"] += 1
                await db.rollback()
                # Continuar con el siguiente empleado

        await db.commit()
        return stats

    async def _procesar_empleado(self, db: AsyncSession, emp_it: dict) -> str:
        local = await EmpleadoRepository(db).get_by_num_empleado(emp_it["num_empleado"])

        if not local:
            return await self._insertar(db, emp_it)

        # RN-505: verificar conflicto de email antes de actualizar
        if local.email != emp_it["email"]:
            conflicto = await EmpleadoRepository(db).get_by_email(emp_it["email"])
            if conflicto and conflicto.id != local.id:
                await ItSyncLog.registrar(
                    db, operacion="update", empleado_id=emp_it["num_empleado"],
                    datos=emp_it, status="error",
                    error_msg=f"email_conflict: {emp_it['email']} ya existe para {conflicto.num_empleado}"
                )
                await NotificacionService.notificar(
                    destinatarios=["rh"], evento="it_sync_email_conflict",
                    datos={"num_empleado": emp_it["num_empleado"], "email": emp_it["email"]}
                )
                return "error"

        if not self._datos_cambiaron(local, emp_it):
            return "skip"

        if not emp_it["activo"] and local.activo:
            return await self._desactivar(db, local, emp_it)

        return await self._actualizar(db, local, emp_it)

    async def _insertar(self, db: AsyncSession, emp_it: dict) -> str:
        import bcrypt
        # RN-506: password temporal = hash del num_empleado
        password_temp = bcrypt.hashpw(emp_it["num_empleado"].encode(), bcrypt.gensalt()).decode()
        rol_empleado = await RolRepository(db).get_by_nombre("empleado")

        nuevo = Empleado(
            num_empleado=emp_it["num_empleado"],
            nombre=emp_it["nombre"],
            apellido=emp_it["apellido"],
            email=emp_it["email"],
            password_hash=password_temp,
            departamento=emp_it.get("departamento"),
            puesto=emp_it.get("puesto"),
            rol_id=rol_empleado.id,
            supervisor_id=None,  # RH asigna manualmente
            activo=True,
            fecha_ingreso=emp_it.get("fecha_ingreso"),
        )
        db.add(nuevo)
        await db.flush()

        await AuditLogger.log_action(
            db, usuario_id=None, accion="it_sync_insert",
            modulo="it_sync", entidad_id=nuevo.id,
            datos_despues={"num_empleado": emp_it["num_empleado"]}
        )
        await ItSyncLog.registrar(
            db, operacion="insert", empleado_id=emp_it["num_empleado"],
            datos=emp_it, status="ok"
        )
        await NotificacionService.notificar(
            destinatarios=["rh"], evento="nuevo_empleado_sync",
            datos={"num_empleado": emp_it["num_empleado"], "nombre": emp_it["nombre"]}
        )
        return "insert"

    async def _desactivar(self, db: AsyncSession, local: Empleado, emp_it: dict) -> str:
        datos_antes = {"activo": True}
        local.activo = False

        # RN-507: cancelar solicitudes PENDING
        canceladas = await SolicitudRepository(db).cancelar_pendientes(local.id)

        await AuditLogger.log_action(
            db, usuario_id=None, accion="it_sync_deactivate",
            modulo="it_sync", entidad_id=local.id,
            datos_antes=datos_antes,
            datos_despues={"activo": False, "solicitudes_canceladas": canceladas}
        )
        await ItSyncLog.registrar(
            db, operacion="deactivate", empleado_id=emp_it["num_empleado"],
            datos={"solicitudes_canceladas": canceladas}, status="ok"
        )
        await NotificacionService.notificar(
            destinatarios=["rh"], evento="empleado_desactivado_sync",
            datos={"empleado_id": local.id, "num_empleado": local.num_empleado,
                   "solicitudes_canceladas": canceladas}
        )
        return "deactivate"

    def _datos_cambiaron(self, local: Empleado, emp_it: dict) -> bool:
        """RN-501: solo comparar campos sincronizables."""
        campos = ["nombre", "apellido", "email", "departamento", "puesto", "activo", "fecha_ingreso"]
        for campo in campos:
            if getattr(local, campo) != emp_it.get(campo):
                return True
        return False
```

### Notificaciones disparadas

| Evento | Canal | Destinatarios |
|---|---|---|
| Nuevo empleado sincronizado | in-app | RH (completar supervisor_id y rol_id) |
| Empleado desactivado | in-app + email | RH (con lista de solicitudes canceladas) |
| Conflicto de email | in-app (alta prioridad) | RH |
| BD IT no disponible | in-app + email | RH + IT (canal a definir) |
| Empleado reactivado | in-app | RH |

---

## FLUJO 6 — Robot TRESS (RPA)

### Diagrama de estados (por item en cola)

```
  FastAPI encola (fire-and-forget)
           |
           v
       +----------+
       | PENDING  |  Cola en BD, robot no ha procesado aun
       +----------+
           |
  Robot APScheduler cada 5 min
  toma items PENDING o RETRYING
           |
      Ejecutar en TRESS GUI
      /              \
  Exito             Fallo
     |                 |
     v            intentos < 3?
  +------+        /         \
  | DONE |      SI            NO
  +------+      |              |
    |          SET          +-------+
  audit_log  estado=       | ERROR |
             RETRYING      +-------+
                |              |
           intentos++      audit_log
                |          notif RH
           audit_log
```

### Tabla de transiciones

| Actor | Accion | Estado anterior | Estado nuevo | Condicion | Side effects |
|---|---|---|---|---|---|
| FastAPI | encolar operacion | — | PENDING | cualquier flujo que genera accion GUI Write | INSERT TressRobotQueue; audit_log; retornar HTTP 200 inmediatamente |
| robot (APScheduler) | procesar exitoso | PENDING o RETRYING | DONE | TRESS acepta la operacion | processed_at=now(); audit_log |
| robot (APScheduler) | procesar fallido (reintento) | PENDING o RETRYING | RETRYING | TRESS falla; intentos < 3 | intentos++; error_msg=mensaje_tress; audit_log |
| robot (APScheduler) | procesar fallido (final) | RETRYING | ERROR | intentos >= 3 | error_msg=mensaje_tress; notificar RH; audit_log |

### Reglas de negocio

**Cola**
- RN-601: Solo GUI Write pasa por la cola. SQL Read es siempre directo y sincrono, nunca se encola.
- RN-602: FastAPI encola y retorna HTTP 200 inmediatamente. No espera respuesta del robot. El resultado de TRESS es asincrono.
- RN-603: El robot APScheduler consulta `tress_robot_queue` cada 5 minutos, toma todos los items con `estado in ('pending', 'retrying')` ordenados por `created_at ASC` (FIFO).
- RN-604: Maximo 3 intentos por operacion (`intentos` field). Despues del tercer fallo: `estado='error'`, `error_msg` con el ultimo mensaje de error de TRESS.
- RN-605: El campo `intentos` se incrementa en cada intento fallido. Al transicionar a DONE, `processed_at = datetime.now(utc)`.

**Operaciones validas**
- RN-606: Las acciones validas en la cola son: `registrar_vacaciones`, `registrar_incidencia_nomina`, `alta_empleado_tress`. Cualquier otro valor en el campo `accion` debe rechazarse al encolar con HTTP 422.
- RN-607: El payload JSONB debe contener exactamente los campos requeridos por cada accion:
  - `registrar_vacaciones`: `{solicitud_id, empleado_num, fecha_inicio, fecha_fin, dias_solicitados}`
  - `registrar_incidencia_nomina`: `{incidencia_id, empleado_num, tipo, fecha}`
  - `alta_empleado_tress`: `{empleado_id, num_empleado, nombre, apellido, departamento, puesto, fecha_ingreso}`

**Auditoria**
- RN-608: Cada transicion de estado en `tress_robot_queue` se registra en `audit_log` con `modulo='tress_robot'`, `entidad_id=queue_item.id`, `usuario_id=NULL` (operacion de sistema).
- RN-609: Al llegar a ERROR (3 intentos): notificar a RH con el detalle del item fallido para intervencion manual.

**Idempotencia**
- RN-610: El robot debe verificar antes de ejecutar en TRESS que la operacion no fue ya procesada exitosamente (verificar `estado != 'done'`). Esto previene doble registro si el robot falla despues de ejecutar en TRESS pero antes de actualizar la BD.

### Casos borde y manejo

- **CB-601: TRESS GUI no esta abierto o la sesion expiro.**
  Comportamiento: El robot intenta reconectar/reabrir TRESS. Si no puede en el timeout definido: incrementar `intentos`, pasar a RETRYING. Registrar `error_msg='tress_session_unavailable'`.

- **CB-602: El robot procesa exitosamente en TRESS pero falla al actualizar la BD (crash post-commit).**
  Comportamiento: RN-610 previene la doble ejecucion si el item aun esta en PENDING. Si el robot ya ejecuto en TRESS pero no actualizo la BD: en el siguiente ciclo volvera a intentar. Se requiere que el robot implemente idempotencia en cada accion TRESS (verificar si el registro ya existe antes de insertar).

- **CB-603: Item en ERROR — RH quiere reintentarlo manualmente.**
  Comportamiento: RH puede resetear el item via endpoint administrativo: `PUT /api/v1/tress/queue/{id}/retry` con rol rh. Esto pone `estado='pending'`, `intentos=0`, `error_msg=NULL`. Registrar en audit_log.

- **CB-604: Se encola un `registrar_vacaciones` pero la solicitud fue cancelada antes de que el robot la procese.**
  Comportamiento: El robot debe verificar el estado actual de la solicitud antes de ejecutar en TRESS. Si `solicitud.estado != 'approved'`: marcar el item como DONE con nota `"operacion_obsoleta"` y no ejecutar en TRESS.

- **CB-605: Multiples items PENDING para el mismo empleado y la misma operacion.**
  Comportamiento: El robot los procesa en orden FIFO. Se recomienda agregar validacion al encolar para evitar duplicados: verificar si ya existe un item PENDING/RETRYING con el mismo `accion` y `payload.solicitud_id` (o equivalente). Si existe, no encolar de nuevo.

### Pseudocodigo del Service

```python
class TressRobotService:

    # --- Lado FastAPI: encolar (fire-and-forget) ---

    async def encolar(
        self,
        db: AsyncSession,
        accion: str,
        payload: dict,
        usuario_id: int | None = None,
    ) -> TressRobotQueue:
        # RN-606: validar accion
        ACCIONES_VALIDAS = {"registrar_vacaciones", "registrar_incidencia_nomina", "alta_empleado_tress"}
        if accion not in ACCIONES_VALIDAS:
            raise HTTPException(422, f"Accion no valida: {accion}")

        # RN-607: validar campos del payload
        self._validar_payload(accion, payload)

        # CB-605: verificar duplicado
        duplicado = await TressQueueRepository(db).existe_pendiente(accion, payload)
        if duplicado:
            # No encolar de nuevo; retornar el existente
            return duplicado

        item = TressRobotQueue(
            accion=accion,
            payload=payload,
            estado="pending",
            intentos=0,
        )
        db.add(item)
        await db.flush()

        await AuditLogger.log_action(
            db, usuario_id=usuario_id, accion="tress_encolar",
            modulo="tress_robot", entidad_id=item.id,
            datos_despues={"accion": accion, "payload_keys": list(payload.keys())}
        )
        await db.commit()
        return item

    # --- Lado Robot: procesar cola (APScheduler cada 5 min) ---

    async def procesar_cola(self, db: AsyncSession) -> None:
        # RN-603: tomar items PENDING o RETRYING en orden FIFO
        items = await TressQueueRepository(db).get_pendientes_ordenados()

        for item in items:
            await self._procesar_item(db, item)

    async def _procesar_item(self, db: AsyncSession, item: TressRobotQueue) -> None:
        # RN-610: verificar estado actual (por si ya fue procesado)
        item_actual = await TressQueueRepository(db).get_by_id(item.id)
        if item_actual.estado == "done":
            return

        # CB-604: verificar vigencia de la operacion
        if not await self._operacion_vigente(db, item):
            item.estado = "done"
            item.processed_at = datetime.now(timezone.utc)
            item.error_msg = "operacion_obsoleta"
            await AuditLogger.log_action(
                db, usuario_id=None, accion="tress_operacion_obsoleta",
                modulo="tress_robot", entidad_id=item.id,
                datos_despues={"accion": item.accion}
            )
            await db.commit()
            return

        try:
            await TressGUIClient.ejecutar(item.accion, item.payload)
            # Exito
            item.estado = "done"
            item.processed_at = datetime.now(timezone.utc)
            await AuditLogger.log_action(
                db, usuario_id=None, accion="tress_procesado_ok",
                modulo="tress_robot", entidad_id=item.id,
                datos_despues={"accion": item.accion}
            )
        except TressError as e:
            # Fallo
            item.intentos += 1
            item.error_msg = str(e)

            if item.intentos >= 3:
                # RN-604: maximo reintentos alcanzado
                item.estado = "error"
                await AuditLogger.log_action(
                    db, usuario_id=None, accion="tress_error_final",
                    modulo="tress_robot", entidad_id=item.id,
                    datos_despues={"accion": item.accion, "intentos": item.intentos, "error": str(e)}
                )
                await NotificacionService.notificar(
                    destinatarios=["rh"],
                    evento="tress_item_error",
                    datos={
                        "queue_id": item.id,
                        "accion": item.accion,
                        "error": str(e),
                        "payload": item.payload
                    }
                )
            else:
                item.estado = "retrying"
                await AuditLogger.log_action(
                    db, usuario_id=None, accion="tress_reintento",
                    modulo="tress_robot", entidad_id=item.id,
                    datos_despues={"accion": item.accion, "intentos": item.intentos}
                )

        await db.commit()

    async def retry_manual(
        self, db: AsyncSession, queue_id: int, actor: Empleado
    ) -> TressRobotQueue:
        """CB-603: RH resetea manualmente un item en ERROR."""
        if actor.rol.nombre != "rh":
            raise HTTPException(403, "Solo RH puede reintentar items de la cola TRESS")

        item = await TressQueueRepository(db).get_by_id(queue_id)
        if item.estado != "error":
            raise HTTPException(409, "Solo se pueden reintentar items en estado ERROR")

        datos_antes = {"estado": item.estado, "intentos": item.intentos}
        item.estado = "pending"
        item.intentos = 0
        item.error_msg = None

        await AuditLogger.log_action(
            db, usuario_id=actor.id, accion="tress_retry_manual",
            modulo="tress_robot", entidad_id=item.id,
            datos_antes=datos_antes, datos_despues={"estado": "pending", "intentos": 0}
        )
        await db.commit()
        return item

    async def _operacion_vigente(self, db: AsyncSession, item: TressRobotQueue) -> bool:
        """CB-604: Verifica que la operacion todavia es valida."""
        if item.accion == "registrar_vacaciones":
            solicitud_id = item.payload.get("solicitud_id")
            solicitud = await SolicitudRepository(db).get_by_id(solicitud_id)
            return solicitud is not None and solicitud.estado == "approved"
        # Para otras acciones, siempre vigente
        return True

    def _validar_payload(self, accion: str, payload: dict) -> None:
        CAMPOS_REQUERIDOS = {
            "registrar_vacaciones": {"solicitud_id", "empleado_num", "fecha_inicio", "fecha_fin", "dias_solicitados"},
            "registrar_incidencia_nomina": {"incidencia_id", "empleado_num", "tipo", "fecha"},
            "alta_empleado_tress": {"empleado_id", "num_empleado", "nombre", "apellido", "departamento", "puesto", "fecha_ingreso"},
        }
        requeridos = CAMPOS_REQUERIDOS[accion]
        faltantes = requeridos - set(payload.keys())
        if faltantes:
            raise HTTPException(422, f"Payload incompleto para {accion}: faltan {faltantes}")
```

### Notificaciones disparadas

| Evento | Canal | Destinatarios |
|---|---|---|
| Item llega a ERROR (3 intentos) | in-app + email (alta prioridad) | RH |
| Retry manual ejecutado | in-app (confirmacion) | RH |
| Cola procesada sin errores | (sin notificacion — solo audit_log) | — |

---

## RESUMEN DE SUPOSICIONES Y PENDIENTES DE CONFIRMACION

Las siguientes decisiones fueron tomadas con supuestos razonables y **requieren validacion con Leoni** antes de implementar:

| ID | Flujo | Supuesto / Pendiente | Impacto |
|---|---|---|---|
| AS-01 | Comedor | Corte de registro: domingo 23:59 de la semana anterior. Debe confirmarse o hacerse configurable. | Afecta RN-403 y logica de `_calcular_corte` |
| AS-02 | Comedor | Acceso al comedor es una vez por semana (no por dia). Confirmar si es por dia de la semana de trabajo. | Afecta RN-412 y el modelo ComedorRegistro |
| AS-03 | Comedor | El campo `huella_id` mapea a un empleado. Se asume tabla `empleado_huellas` o campo en `Empleado`. El modelo actual no tiene este campo — **debe agregarse**. | Bloquea implementacion de RN-410 |
| AS-04 | Actas | Hay exactamente un Director activo. Si hay multiples directores, la logica de `_resolver_firmantes` debe seleccionar con criterio adicional. | Afecta RN-211 |
| AS-05 | Incidencias | Los tipos de incidencia con efecto en TRESS son exclusivamente `falta` y `retardo`. Confirmar si hay otros tipos que impactan nomina. | Afecta RN-110 |
| AS-06 | Solicitudes | La vista SQL de TRESS para saldo de vacaciones es `v_saldos_vacaciones(num_empleado, dias_disponibles)`. Confirmar nombre y estructura real. | Afecta RN-005 |
| AS-07 | IT Sync | Los campos sincronizables desde IT son los listados en RN-501. Confirmar que no hay campos adicionales (ej. turno, CURP, NSS). | Afecta el mapper del sync |
| AS-08 | Actas | No hay SLA de firma — los firmantes pueden tardar indefinidamente. Confirmar si debe existir recordatorio automatico o escalamiento. | Nuevo requerimiento potencial |

---

## DEPENDENCIAS ENTRE FLUJOS

```
Solicitud APPROVED (vacaciones)
    └──> tress_robot_queue [registrar_vacaciones]

Incidencia CLOSED (falta/retardo)
    └──> tress_robot_queue [registrar_incidencia_nomina]

Incidencia (in_review/resolved/closed)
    └──> puede generar ActaAdministrativa

IT Sync DEACTIVATE
    └──> Cancelar Solicitudes PENDING del empleado

RH crea empleado en plataforma
    └──> tress_robot_queue [alta_empleado_tress]

ActaAdministrativa ARCHIVED
    └──> vinculada al expediente del empleado
         (ExpedienteService — pendiente de documentar)
```

---

Los archivos de memoria del proyecto han sido guardados en `/Users/alexmiramontes/.claude/agent-memory/hr-business-logic-analyst/`. Esta especificacion esta lista para ser consumida directamente por el agente `fastapi-backend-architect`.agentId: ac2311ecf8f10f07a (use SendMessage with to: 'ac2311ecf8f10f07a' to continue this agent)
<usage>total_tokens: 60793
tool_uses: 27
duration_ms: 726019</usage>