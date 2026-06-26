# Evaluaciones Workflow de Estados

> Feature slug: `evaluaciones-workflow-estados`
> Branch: `claude/feature/evaluaciones-workflow-estados`
> Date: 2026-06-25
> Status: Planned
> Dependencia: Fase 2 Evaluaciones (COMPLETADA — CRUD simple funcional)

---

## Problem Statement

El modulo de evaluaciones de competencias (`/api/v1/evaluaciones/`) actualmente opera como un CRUD simple sin ciclo de vida. Cualquier usuario con rol RH o supervisor puede crear, editar y eliminar evaluaciones en cualquier momento sin restricciones de flujo.

El PLAN_TALENTO Fase 3 requiere un flujo de estados: **borrador → enviado → revisado → cerrado**, con validaciones por rol en cada transicion. Esto permite:
- Que el empleado participe en su autoevaluacion (borrador).
- Que el supervisor valide/ajuste la evaluacion (revision).
- Que RH cierre el ciclo y los datos queden inmutables para historico.
- Trazabilidad de quien hizo que y cuando.

---

## Goals

- Agregar un ciclo de vida con estados al modelo de evaluaciones existente
- Permitir autoevaluacion por parte del empleado (estado borrador)
- Supervisor revisa y puede ajustar niveles (estado revision)
- RH cierra el ciclo (estado cerrado = inmutable)
- Mantener compatibilidad con las evaluaciones existentes (migrar a estado "cerrado")
- Registrar historial de transiciones para auditoria

---

## Non-Goals

- Evaluaciones 360 (multiples evaluadores) — futura fase
- Periodos de evaluacion formales (Q1, Q2, anual) — se puede agregar despues
- Flujo de feedback por texto separado (modelo `Feedback` del PLAN_TALENTO) — spec aparte
- Notificaciones automaticas por cambio de estado — deseable pero no bloqueante para MVP
- Dashboard de evaluaciones con metricas agregadas

---

## User Stories

1. **Como empleado**, quiero crear una autoevaluacion (borrador) asignandome un nivel por competencia para que mi supervisor la revise.
2. **Como empleado**, quiero enviar mi autoevaluacion para revision cuando la considere completa.
3. **Como supervisor**, quiero ver las evaluaciones enviadas por mis empleados para revisarlas y ajustar niveles si es necesario.
4. **Como supervisor**, quiero marcar una evaluacion como "revisada" una vez que estoy de acuerdo con los niveles.
5. **Como RH**, quiero cerrar evaluaciones revisadas para que los datos queden inmutables y se reflejen en brechas/cumplimiento.
6. **Como RH**, quiero poder rechazar una evaluacion (devolver a borrador) si tiene errores para que el empleado/supervisor la corrija.
7. **Como RH**, quiero ver el historial de transiciones de una evaluacion para auditoria.

---

## Data Model

### Cambios al modelo existente `EvaluacionCompetencia`

Agregar columna `estado` con enum:

| Estado | Descripcion | Quien puede ver | Quien puede editar niveles |
|--------|------------|-----------------|---------------------------|
| `borrador` | Empleado creando autoevaluacion | empleado, supervisor, rh | empleado |
| `enviado` | Listo para revision del supervisor | supervisor, rh | nadie (bloqueado) |
| `en_revision` | Supervisor revisando/ajustando | supervisor, rh | supervisor |
| `revisado` | Supervisor confirmo, pendiente cierre RH | rh | nadie |
| `cerrado` | Inmutable, se usa para calculos de brechas | todos | nadie |
| `devuelto` | RH o supervisor devolvio para correccion | empleado, supervisor, rh | empleado |

### Nueva tabla `levelup_evaluacion_transiciones`

Historial de cambios de estado:

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | serial PK | |
| evaluacion_id | FK levelup_evaluaciones_competencia.id | Evaluacion afectada |
| estado_anterior | varchar(20) | Estado desde |
| estado_nuevo | varchar(20) | Estado hacia |
| actor_id | FK empleados.empleado_id | Quien ejecuto la transicion |
| comentario | text, nullable | Motivo (obligatorio en devolucion/rechazo) |
| created_at | timestamptz | Cuando ocurrio |

### Transiciones validas (maquina de estados)

```
borrador  → enviado       (empleado)
borrador  → cerrado       (rh — atajo para evaluaciones hechas por rh directamente)
enviado   → en_revision   (supervisor — al abrir para revisar)
enviado   → devuelto      (supervisor — devolver con comentario)
en_revision → revisado    (supervisor — confirmar)
en_revision → devuelto    (supervisor — devolver con comentario)
revisado  → cerrado       (rh)
revisado  → devuelto      (rh — devolver con comentario)
devuelto  → enviado       (empleado — reenviar tras correccion)
cerrado   → (terminal, sin transiciones salientes)
```

### Migracion de datos existentes

Las evaluaciones actuales (creadas por RH/supervisor sin workflow) se migran a estado `cerrado` ya que representan evaluaciones validadas.

---

## API Endpoints

### Nuevos endpoints de transicion

| Metodo | Path | Rol | Descripcion |
|--------|------|-----|-------------|
| POST | `/api/v1/evaluaciones/{id}/enviar` | empleado (dueño) | Transicionar borrador → enviado |
| POST | `/api/v1/evaluaciones/{id}/revisar` | supervisor | Tomar para revision (enviado → en_revision) |
| POST | `/api/v1/evaluaciones/{id}/aprobar` | supervisor | Confirmar revision (en_revision → revisado) |
| POST | `/api/v1/evaluaciones/{id}/cerrar` | rh | Cerrar evaluacion (revisado → cerrado, o borrador → cerrado) |
| POST | `/api/v1/evaluaciones/{id}/devolver` | supervisor, rh | Devolver con comentario (body: `{comentario: string}`) |
| GET | `/api/v1/evaluaciones/{id}/historial` | auth | Ver transiciones de una evaluacion |

### Cambios a endpoints existentes

| Endpoint | Cambio |
|----------|--------|
| `POST /api/v1/evaluaciones` | Empleado puede crear con estado `borrador` (actualmente solo rh/supervisor) |
| `PUT /api/v1/evaluaciones/{id}` | Solo permitido si estado es `borrador` (para empleado) o `en_revision` (para supervisor) |
| `GET /api/v1/evaluaciones` | Agregar filtro `?estado=borrador,enviado,...` |
| `DELETE /api/v1/evaluaciones/{id}` | Solo permitido si estado es `borrador` |

### Nuevos query params

- `estado` — filtrar por estado(s), separados por coma
- `mis_pendientes` — boolean, si true filtra evaluaciones pendientes de accion del usuario segun su rol

---

## Frontend

### Pagina `evaluaciones.ts` — Cambios

- Agregar tab/filtro por estado (Borrador | Enviados | En revision | Revisados | Cerrados)
- Mostrar badge de estado en cada fila de la tabla (colores: borrador=gris, enviado=azul, en_revision=amarillo, revisado=verde-claro, cerrado=verde, devuelto=rojo)
- Botones de accion contextual segun estado y rol del usuario:
  - Empleado ve boton "Enviar" en sus borradores
  - Supervisor ve boton "Revisar" en evaluaciones enviadas de su area
  - RH ve boton "Cerrar" en evaluaciones revisadas
- Desactivar edicion de `nivel_actual` cuando el estado no lo permite

### Pagina `evaluacionEmpleado.ts` — Cambios

- Mostrar estado actual de la evaluacion con badge
- Si el empleado es el dueño y estado=borrador: sliders editables + boton "Enviar a revision"
- Si supervisor y estado=en_revision: sliders editables + boton "Aprobar" / "Devolver"
- Si cerrado: todo read-only

### Modal de devolucion

- Aparece al hacer click en "Devolver"
- Textarea con comentario obligatorio (min 10 caracteres)
- Boton confirmar / cancelar

### Modal de historial

- Accesible desde el detalle de cualquier evaluacion
- Timeline vertical con: fecha, actor, transicion (de → a), comentario

---

## Decisions

1. **Estado `en_revision` separado de `enviado`**: permite que el supervisor "tome" la evaluacion explicitamente, evitando que dos supervisores la editen simultaneamente.
2. **RH puede cerrar directamente desde `borrador`**: para mantener el flujo actual donde RH crea evaluaciones ya definitivas sin pasar por empleado/supervisor.
3. **`devuelto` como estado propio** (no reutilizar `borrador`): permite distinguir en reportes cuantas evaluaciones fueron devueltas vs creadas frescas.
4. **Evaluaciones existentes → estado `cerrado`**: garantiza que los calculos de brechas/cumplimiento siguen funcionando sin cambios.
5. **Un registro por (empleado, competencia)**: se mantiene la constraint UNIQUE existente. El workflow aplica a la misma fila (no se crean versiones nuevas).
6. **Sin periodos formales**: el ciclo se abre cuando el empleado o RH crea la evaluacion. Periodos se pueden agregar como feature separada.

---

## Validation Rules

### Transiciones

- Cada endpoint de transicion valida que el estado actual permite la transicion destino (segun la maquina de estados).
- El actor debe tener el rol permitido para esa transicion.
- Si el actor es supervisor, debe ser supervisor del area del empleado evaluado.
- `devolver` requiere `comentario` no vacio (min 10 chars).

### Edicion de niveles

- `PUT /evaluaciones/{id}` verifica:
  - Si actor es empleado: solo editable en estado `borrador` o `devuelto`, y solo su propia evaluacion.
  - Si actor es supervisor: solo editable en estado `en_revision`, y solo empleados de su area.
  - Si actor es rh: editable en `borrador`, `en_revision` (override administrativo).
  - En cualquier otro estado: 409 Conflict.

### Creacion

- Empleado puede crear evaluacion propia (estado=borrador).
- RH puede crear evaluacion de cualquier empleado (estado=borrador o cerrado directo via endpoint cerrar).
- Supervisor puede crear evaluacion de empleado de su area (estado=borrador).

---

## Acceptance Criteria

- [ ] Nuevo campo `estado` en `levelup_evaluaciones_competencia` con default `cerrado` (para compatibilidad)
- [ ] Migracion asigna `cerrado` a todas las evaluaciones existentes
- [ ] Tabla `levelup_evaluacion_transiciones` creada con FK e indices
- [ ] Empleado puede crear autoevaluacion (borrador) y enviarla
- [ ] Supervisor puede tomar, revisar, aprobar o devolver evaluaciones de su area
- [ ] RH puede cerrar evaluaciones revisadas o crear evaluaciones directas (cerradas)
- [ ] RH puede devolver evaluaciones con comentario obligatorio
- [ ] Editar niveles esta bloqueado fuera de los estados permitidos (409)
- [ ] Eliminar solo funciona en estado borrador
- [ ] Historial de transiciones registrado y consultable
- [ ] Filtro por estado funciona en el listado
- [ ] Frontend muestra badges de estado y botones contextuales
- [ ] Evaluaciones `cerrado` se usan en calculos de brechas/cumplimiento (sin regresion)
- [ ] Tests cubren: transiciones validas, transiciones invalidas (403/409), permisos por rol, historial

---

## Files to Create/Modify

### Backend

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `app/models/talento.py` | Modificar | Agregar campo `estado` a `EvaluacionCompetencia`, modelo `EvaluacionTransicion` |
| `alembic/versions/xxxx_evaluaciones_workflow.py` | Crear | Migracion: columna estado + tabla transiciones + datos existentes → cerrado |
| `app/schemas/evaluaciones.py` | Modificar | Agregar campo estado a Response, schemas para transicion y historial |
| `app/services/evaluacion_service.py` | Modificar | Logica de transiciones, validaciones de estado en CRUD |
| `app/api/v1/evaluaciones/router.py` | Modificar | 6 endpoints nuevos de transicion + filtro estado |

### Frontend

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `frontend/src/pages/evaluaciones.ts` | Modificar | Tabs por estado, badges, botones contextuales |
| `frontend/src/pages/evaluacionEmpleado.ts` | Modificar | Estado read-only/editable segun workflow, botones de accion |
| `frontend/src/api/evaluaciones.ts` | Modificar | Funciones para endpoints de transicion + historial |

### Tests

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `tests/test_evaluaciones_workflow.py` | Crear | Tests del flujo completo, transiciones invalidas, permisos |
