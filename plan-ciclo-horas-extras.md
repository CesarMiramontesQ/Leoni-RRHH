# Plan: Ciclo completo de Horas Extras

> Plan técnico-funcional para cerrar el ciclo de aprobación de horas extras en la plataforma de RRHH de Leoni Cable (FastAPI async + Vite/TypeScript). Adaptado a los modelos, rutas y convenciones reales del proyecto.

## Estado actual (lo que ya existe)

La sección de Nóminas ya permite:

- **Autorizar empleados** para registrar horas extra (`empleados.puede_registrar_horas_extra`).
- **Configurar aprobadores** (RH): gerentes regionales y un único director (`horas_extra_aprobadores`).
- **Registrar horas extra**: empleados autorizados crean solicitudes (`horas_extra_solicitudes` + `horas_extra_solicitud_detalle`), estado inicial `pendiente`.
- **Vista RH de lectura**: listado de solicitudes con filtros, tabs y resumen.

La **infraestructura de datos del ciclo de aprobación ya está creada** pero **sin lógica que la opere**:

- `horas_extra_aprobaciones` — registro de firmas (`tipo_firma`, `estado`, `aprobador_id`, `fecha_aprobacion`, `comentario`). Ya existe pero **no se generan ni se firman filas**.
- Sistema de **notificaciones** (`NotificacionService`), **auditoría** (`audit_log`) y **permisos por rol** (`role_checker`) — listos para reutilizar.

### Brecha a implementar

1. Generar filas `HorasExtraAprobacion` pendientes **al crear la solicitud**.
2. **Función centralizada** de cálculo de estado a partir de las firmas.
3. **Endpoints** para gerente regional / director: listar pendientes, aprobar, rechazar, historial; y estado consolidado para RH.
4. **Vistas frontend** de aprobación (gerente regional y director) + estado consolidado RH.
5. **Notificaciones** del flujo (asignación, aprobación parcial, aprobado final, rechazo).
6. **Validaciones** de aprobación/rechazo.

### Decisiones de negocio confirmadas

| # | Decisión | Implicación |
|---|----------|-------------|
| 1 | **Aprobación en PARALELO** | Gerente regional y director ven la solicitud desde el inicio y aprueban en cualquier orden. No hay etapas secuenciales. |
| 2 | **Rechazo CANCELA definitivamente** | Estado `rechazado` terminal. Para reintentar, RH crea una solicitud nueva. No reactivable. |
| 3 | **Notificaciones por AMBOS canales** | `canal="ambos"` (in-app + correo SMTP) en cada evento. |
| 4 | **Firmas creadas AL CREAR la solicitud** | Al registrar horas extra se generan automáticamente las filas pendientes según aprobadores activos. |

---

## 1. Resumen del flujo requerido

1. RH autoriza empleados y configura aprobadores (gerente(s) regional(es) + director). *(ya existe)*
2. Un empleado autorizado **registra horas extra** → se crea la solicitud en estado `pendiente`.
3. **Al crear la solicitud**, el sistema genera automáticamente las filas de aprobación pendientes en `horas_extra_aprobaciones`, una por cada aprobador activo (`tipo_firma = gerente_regional` y `tipo_firma = director_planta`).
4. El sistema **notifica** (in-app + correo) a gerente(s) regional(es) y director que tienen una solicitud pendiente.
5. **Gerente regional** entra a su vista, revisa y **aprueba o rechaza** (en cualquier orden respecto al director).
6. **Director** entra a su vista, revisa y **aprueba o rechaza** (en cualquier orden respecto al gerente).
7. RH visualiza el **estado consolidado** (calculado), quién aprobó, quién falta y comentarios de rechazo.
8. El registro aparece como **`aprobado`** para RH **solo cuando**:
   - existe **al menos una** aprobación de `gerente_regional`, **y**
   - existe la aprobación del `director`.
9. Un registro `aprobado` queda **listo para nómina**.

---

## 2. Reglas de negocio

- **No** se considera `aprobado` si solo aprobó el gerente regional.
- **No** se considera `aprobado` si solo aprobó el director.
- El estado **final** `aprobado` requiere, evaluado sobre `horas_extra_aprobaciones`:
  - existe fila con `tipo_firma = gerente_regional` y `estado = aprobado` (basta una), **y**
  - existe fila con `tipo_firma = director_planta` y `estado = aprobado`.
- Si hay **más de un gerente regional** asignado, **basta con que uno apruebe**.
- Si **cualquier** aprobador rechaza → la solicitud pasa a **`rechazado` (terminal)** (decisión 2). No se reabre; RH crea una nueva si procede.
- Cada decisión (aprobación/rechazo) guarda en `horas_extra_aprobaciones`:
  - **Usuario aprobador** → `aprobador_id`
  - **Rol del aprobador** → `rol_aprobador_id` + `rol_aprobador_nombre` (y el `tipo_firma`)
  - **Fecha y hora** → `fecha_aprobacion`
  - **Acción** → `estado` (`aprobado` / `rechazado`)
  - **Comentario** → `comentario` (opcional al aprobar, **obligatorio al rechazar**)
- Cada acción se registra además en `audit_log` (acción, módulo `nominas`/`horas_extra`, `datos_antes`/`datos_despues`) para trazabilidad multi-evento.
- RH puede **consultar el historial completo** de aprobaciones de una solicitud.

---

## 3. Vistas necesarias

> Reutilizar el patrón de modal de detalle con acciones de `frontend/src/components/solicitudes/solicitudDetalleModal.ts` e `frontend/src/components/incidencias/rhIncidenciaDetalleModal.ts`, y el desglose por día de `frontend/src/horasExtra/shared/renderHorasExtraDetalleModal.ts`. Badges desde `frontend/src/ui/uiTokens.ts` (`badgePending/Approved/Rejected/Cancelled`).

### 3.1 Vista para gerente regional

Nueva página (p.ej. `frontend/src/pages/horasExtraAprobaciones.ts`, ruta `#/nominas/horas-extra/aprobaciones`) que permite:

- Ver registros de horas extra **pendientes de su aprobación** (donde es aprobador `gerente_regional` activo y su firma sigue `pendiente`).
- Filtrar por **empleado, área, fecha, estado y sucursal**.
- Ver **detalle** del registro (desglose por día reutilizando `renderHorasExtraDetalleModal`).
- **Aprobar** registro.
- **Rechazar** registro con **comentario obligatorio**.
- Ver **historial** de sus decisiones.

### 3.2 Vista para director

Misma página/estructura que 3.1, segmentada por el `tipo_firma = director_planta`:

- Ver registros pendientes de su aprobación.
- Filtrar por empleado, área, fecha, estado y sucursal.
- Ver detalle.
- Aprobar.
- Rechazar con comentario obligatorio.
- Ver historial de decisiones.

> La misma vista sirve para ambos roles; el backend resuelve qué firma le corresponde al usuario según su designación en `horas_extra_aprobadores`.

### 3.3 Vista para RH (ampliar la existente)

Ampliar `frontend/src/pages/horasExtra.ts` + `renderHorasExtraDetalleModal` para mostrar:

- Estado **general/consolidado** del registro (calculado, no manual).
- Aprobaciones **pendientes** (quién falta).
- **Quién aprobó y cuándo** (gerente regional / director).
- Comentarios de **rechazo**.
- Indicador de **listo para nómina** (solo si cumple las dos firmas requeridas).

---

## 4. Estados del ciclo

El enum real de `horas_extra_solicitudes.estado` es: `borrador | pendiente | aprobado | rechazado | cancelado`.

El estado se **calcula desde las firmas** (`horas_extra_aprobaciones`), no de un campo manual. Mapeo con los estados pedidos:

| Estado solicitado | Implementación real |
|---|---|
| `borrador` | `estado = borrador` (no usado en el flujo actual de creación). |
| `pendiente_aprobacion` | `estado = pendiente` sin ninguna firma resuelta. |
| `pendiente_gerente_regional` / `pendiente_director` | **No aplican como estados persistidos** (flujo paralelo). Se derivan en la UI mostrando qué firma falta. |
| `aprobado_parcial` | Estado **derivado para UI**: ya hay una firma aprobada pero falta la otra. Persistido como `pendiente`. |
| `aprobado` | `estado = aprobado` (gerente regional **y** director aprobaron). |
| `rechazado` | `estado = rechazado` (terminal). |

> Se persiste en `horas_extra_solicitudes.estado` el resultado de la función central (sección 9) tras cada decisión; `aprobado_parcial` se expone como dato calculado para la UI/RH, no como valor del enum.

---

## 5. Permisos y roles

Roles del sistema (`app/models/roles.py`): `empleado | supervisor | gerente | director | rh`. **"Gerente regional" no es un rol**: es una designación funcional en `horas_extra_aprobadores` (`tipo = gerente_regional`).

- **RH**: crear, editar, asignar aprobadores y consultar todo el flujo. (`role_checker(["rh"])` para ajustes; `{rh, director, gerente}` para lectura, vía `gestor_team_role_checker` cuando aplique).
- **Gerente regional**: solo ve registros donde está asignado como aprobador activo (`horas_extra_aprobadores.tipo = gerente_regional, activo = true`) y existe su firma pendiente.
- **Director**: solo ve registros donde es el director aprobador activo.
- **Ningún aprobador** puede aprobar registros donde no esté asignado (validación a nivel service).
- **Un aprobador no puede firmar dos veces** el mismo registro con el mismo `tipo_firma` (constraint único `(solicitud_id, tipo_firma)` + validación de `estado != pendiente`).
- **RH no puede marcar manualmente** un registro como `aprobado` sin las dos firmas requeridas.

---

## 6. Notificaciones

Canal **`ambos`** (in-app + correo) en todos los eventos, mediante un helper background con sesión propia, replicando `_enviar_notificacion_background(...)` de `app/services/solicitud_service.py` y `NotificacionService.enviar(...)`. `target_url` apunta a la vista correspondiente (p.ej. `#/nominas/horas-extra/aprobaciones` o `#/nominas/horas-extra`) y `metadata` lleva `{entidad: "horas_extra", solicitud_id, evento}`.

### Al crear la solicitud / asignar aprobadores
Destinatarios: **gerente(s) regional(es)** y **director** asignados.
> "Tienes una solicitud de horas extras pendiente de aprobación."

### Al aprobar el gerente regional
Destinatarios: **RH** y **director** (si su firma sigue pendiente).
> "El gerente regional aprobó una solicitud de horas extras. Falta aprobación del director."

### Al aprobar el director
Destinatarios: **RH** y **gerente regional involucrado** (si aplica).
> "El director aprobó una solicitud de horas extras."

### Cuando el registro queda aprobado final
Destinatarios: **RH** y **responsable del registro** (`registrado_por_id`).
> "La solicitud de horas extras fue aprobada y está lista para nómina."

### Al rechazar
Destinatarios: **RH**, **aprobadores involucrados** y **responsable del registro**.
> "La solicitud de horas extras fue rechazada. Revisa los comentarios."

---

## 7. Modelo de datos a validar

**No se requieren tablas nuevas.** Mapeo del esquema genérico solicitado a las tablas reales:

| Esquema genérico | Tabla real | Notas |
|---|---|---|
| `overtime_requests` | `horas_extra_solicitudes` (+ `horas_extra_solicitud_detalle`) | `estado`, `registrado_por_id`, `created_at/updated_at` ya existen. |
| `overtime_approvers` | `horas_extra_aprobadores` (config) + `horas_extra_aprobaciones` (firmas por solicitud) | La asignación por solicitud vive en `horas_extra_aprobaciones` (`tipo_firma`, `aprobador_id`, `estado`, `fecha_aprobacion`, `comentario`). |
| `overtime_approval_history` | `horas_extra_aprobaciones` (estado final por firma) **+** `audit_log` (cada acción) | `horas_extra_aprobaciones` mantiene una fila por `tipo_firma`; para el historial multi-evento (varias acciones, reasignaciones) usar `audit_log` (`accion`, `modulo`, `entidad_id`, `datos_antes`, `datos_despues`, `timestamp`). |
| `notifications` | `notificaciones` | `type`, `title`, `message`, `is_read`, `enviada`, `target_url`, `metadata_json`, `created_at/updated_at`. |
| `users` / `roles` | `empleados` / `roles` | Sin cambios. |

**Ajustes menores posibles:**
- Confirmar que `horas_extra_aprobaciones` se genera al crear la solicitud (hoy no se generan filas).
- Evaluar índice de apoyo para consultas de pendientes por aprobador: `(aprobador_id, estado)` y/o `(tipo_firma, estado)` en `horas_extra_aprobaciones`.
- Mantener consistencia con la constraint existente: estado `pendiente` ⇒ `aprobador_id`/`fecha_aprobacion` NULL; `aprobado|rechazado` ⇒ ambos NOT NULL.

---

## 8. Endpoints o acciones requeridas

Nuevos endpoints, coherentes con el router existente `app/api/v1/nominas/router.py` (prefijo `/api/v1/nominas`):

| Acción | Método y ruta propuesta | Rol |
|---|---|---|
| Listar pendientes del aprobador (gerente regional o director) | `GET /horas-extra/aprobaciones/pendientes` (segmenta según designación del usuario) | gerente, director (y rh para inspección) |
| Detalle de solicitud | `GET /horas-extra/{solicitud_id}` *(ya existe)* | rh, director, gerente |
| Aprobar solicitud | `POST /horas-extra/{solicitud_id}/aprobar` (body: comentario opcional) | gerente regional / director asignado |
| Rechazar solicitud | `POST /horas-extra/{solicitud_id}/rechazar` (body: **comentario obligatorio**) | gerente regional / director asignado |
| Historial de aprobación | `GET /horas-extra/{solicitud_id}/historial` | rh, director, gerente |
| Estado consolidado (RH) | `GET /horas-extra/{solicitud_id}/estado` (quién aprobó / quién falta / listo para nómina) | rh |

Lógica en un nuevo `app/services/horas_extra_aprobacion_service.py` (o extender `horas_extra_service.py`), con su repositorio para consultas de firmas/pendientes. La generación de firmas al crear se añade en `app/services/horas_extra_solicitud_service.py::crear`.

Front: añadir funciones en `frontend/src/api/horasExtra.ts` (`getHorasExtraPendientes`, `aprobarHorasExtra`, `rechazarHorasExtra`, `getHorasExtraHistorial`, `getHorasExtraEstado`).

---

## 9. Lógica de aprobación (función centralizada)

Implementar una función pura que calcule el estado a partir de las firmas de una solicitud (p.ej. `calcular_estado_solicitud(aprobaciones)` en el service):

```text
firmas = horas_extra_aprobaciones de la solicitud

hasRegionalManagerApproval =
  existe firma con tipo_firma = gerente_regional y estado = aprobado

hasDirectorApproval =
  existe firma con tipo_firma = director_planta y estado = aprobado

isRejected =
  existe firma con estado = rechazado

finalStatus =
  rechazado          si isRejected
  aprobado           si hasRegionalManagerApproval y hasDirectorApproval
  aprobado_parcial   si hasRegionalManagerApproval o hasDirectorApproval   (derivado UI; persiste como pendiente)
  pendiente          si no existe ninguna aprobación
```

Usar esta lógica en: **listados**, **detalle**, **vista RH**, **exportaciones**, **notificaciones** y la **validación previa a nómina**. El resultado (`rechazado`/`aprobado`/`pendiente`) se persiste en `horas_extra_solicitudes.estado`; `aprobado_parcial` se expone como bandera calculada.

---

## 10. Validaciones obligatorias

- No aprobar/rechazar **registros inexistentes** (404).
- No aprobar registros **ya aprobados totalmente** (las dos firmas).
- No aprobar registros **rechazados** (terminal por decisión 2).
- No aprobar si el usuario **no es aprobador asignado** (no figura activo en `horas_extra_aprobadores` con el `tipo_firma` correspondiente).
- No aprobar **más de una vez** con el mismo `tipo_firma`.
- **Comentario obligatorio** en rechazo.
- Registrar **fecha, usuario, rol y acción** en cada decisión (`horas_extra_aprobaciones` + `audit_log`).
- **Recalcular el estado** de la solicitud después de cada aprobación/rechazo (función sección 9).
- **Enviar notificaciones** después de cada cambio relevante (sección 6).

---

## 11. Criterios de aceptación

El ciclo se considera terminado cuando:

- [ ] RH puede crear/registrar un registro de horas extra. *(ya existe)*
- [ ] RH puede asignar gerente regional y director. *(ya existe; validar generación de firmas al crear)*
- [ ] Ambos aprobadores reciben notificación (in-app + correo).
- [ ] Gerente regional entra a su vista y aprueba o rechaza.
- [ ] Director entra a su vista y aprueba o rechaza.
- [ ] RH ve "Aprobado" **solo** cuando aprobaron al menos un gerente regional **y** el director.
- [ ] RH puede ver aprobaciones pendientes (quién falta).
- [ ] RH puede ver el historial completo.
- [ ] Un rechazo deja la solicitud en `rechazado` (terminal).
- [ ] Los permisos impiden aprobar registros no asignados.
- [ ] Las notificaciones se generan correctamente en cada evento.
- [ ] El registro `aprobado` queda marcado como listo para nómina.

---

## 12. Plan de implementación por fases

### Fase 1 — Revisión técnica *(cubierta por la exploración)*
- Modelos: `horas_extra_solicitudes`, `horas_extra_solicitud_detalle`, `horas_extra_aprobadores`, `horas_extra_aprobaciones` (`app/models/horas_extra.py`).
- Autorizadores y aprobadores: `app/services/nominas_ajustes_service.py`.
- Estados actuales y vista RH: `app/services/horas_extra_service.py` (helper `_aprobacion_firmada()`).
- Notificaciones: `app/services/notificacion_service.py` + helper background en `app/services/solicitud_service.py`.
- UI reutilizable: `renderHorasExtraDetalleModal`, `solicitudDetalleModal`, badges en `uiTokens.ts`.

### Fase 2 — Modelo y reglas
- Generar filas `HorasExtraAprobacion` pendientes al crear la solicitud (en `horas_extra_solicitud_service.py::crear`).
- Implementar `calcular_estado_solicitud(...)` (sección 9).
- Agregar validaciones de aprobación/rechazo (sección 10).
- Confirmar/añadir índices de apoyo en `horas_extra_aprobaciones`; generar migración Alembic si se requiere.

### Fase 3 — Vistas de aprobación (gerente regional y director)
- Página `frontend/src/pages/horasExtraAprobaciones.ts` (ruta `#/nominas/horas-extra/aprobaciones`), registrada en `shellRouter.ts`, `nominasNav.ts` y `shellNavPolicy.ts`.
- Listado de pendientes + filtros (empleado, área, fecha, estado, sucursal).
- Modal de detalle con acciones Aprobar / Rechazar (comentario obligatorio) e historial.

### Fase 4 — Vista RH consolidada
- Ampliar `frontend/src/pages/horasExtra.ts` + modal para mostrar estado consolidado, quién aprobó/falta, comentarios de rechazo, y bandera "listo para nómina".

### Fase 5 — Notificaciones
- Disparar notificaciones (`canal="ambos"`) en: creación/asignación, aprobación gerente, aprobación director, aprobado final, rechazo (sección 6).
- Validar lectura/consulta vía endpoints existentes de `notificaciones`.

### Fase 6 — Pruebas
- pytest con SQLite in-memory (`tests/conftest.py`), usando factories `make_empleado`, `make_solicitud` y `auth_headers`.
- Casos: flujo completo aprobado; solo gerente; solo director; rechazo gerente; rechazo director; usuario no asignado intentando aprobar; doble aprobación; notificaciones generadas; permisos por rol.

### Fase 7 — Cierre
- Corregir hallazgos.
- Actualizar `openapi.yaml` (nuevos paths/schemas) y `design.md` si se introduce un patrón UI nuevo (según reglas de `CLAUDE.md`).
- Documentar flujo final, validar con RH y dejar checklist de operación.

---

## 13. Pendientes por confirmar

- **`gerente_area` (tercer `tipo_firma` del enum)**: ¿participa en el ciclo o se ignora? El plan actual contempla solo `gerente_regional` + `director_planta` según las decisiones; `gerente_area` queda como nivel opcional no utilizado salvo indicación contraria.
- **Filtro por "sucursal"**: ¿existe un campo de sucursal explícito o se deriva de `area`/`centro_costo`? Definir antes de implementar el filtro de las vistas 3.1/3.2.
- **Integración con nómina/TRESS**: ¿los registros `aprobado` se exportan manualmente o se integran automáticamente con la nómina (TRESS)? Define el alcance del estado "listo para nómina".
- **Edición tras aprobación parcial**: dado que el rechazo es terminal, ¿puede RH editar un registro con una firma ya aprobada y la otra pendiente, o queda bloqueado hasta resolver el ciclo?
