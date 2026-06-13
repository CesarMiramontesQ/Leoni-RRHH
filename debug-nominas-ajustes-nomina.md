# Debug de Nóminas y Ajustes de Nómina

## 1. Alcance revisado

- **Gestión de Horas Extra** (`#/nominas/horas-extra`) — vista RH / director / gerente
- **Ajustes de Nómina** (`#/nominas/ajustes`) — autorizados y aprobadores
- **Aprobación de Horas Extra** (`#/nominas/horas-extra/aprobaciones`) — gerente regional / director designados
- **Registro de Horas Extra** (`#/horas-extra/solicitud`) — registradores autorizados
- **Backend API**: `/api/v1/nominas/*`, `/api/v1/horas-extra/*`

**Fuera de alcance:** Conciliación de nóminas, otras secciones del sistema.

## 2. Roles probados

| Rol | Método de validación |
|-----|---------------------|
| RH | Tests backend + revisión código frontend (gestión, ajustes, detalle) |
| Gerente Regional | Tests aprobación + revisión UI aprobaciones |
| Director | Tests aprobación + revisión permisos API |
| Registrador de horas extras | Tests solicitud supervisor + revisión UI registro |

## 3. Flujos revisados

### RH
- Listado consolidado de solicitudes con filtros, tabs y paginación
- Tarjetas KPI (resumen global, no filtrado — comportamiento documentado)
- Modal **Ver Solicitud** con firmas gerente regional + director e historial
- CRUD de autorizados y aprobadores en Ajustes de Nómina
- Regla de negocio: **Aprobado final** solo con firma gerente regional + director

### Gerente Regional / Director
- Listado filtrado por solicitudes asignadas
- KPIs de aprobación
- Aprobar/rechazar solo desde modal de detalle
- Rechazo con comentario obligatorio (frontend + backend)
- Notificaciones al crear solicitud (backend verificado en tests)

### Registrador
- Crear solicitudes de subordinados autorizados
- Ver solo solicitudes propias
- Sin acceso a aprobar/rechazar ni historial completo (403 esperado)

## 4. Bugs encontrados

### HE-001 — Estado parcial mostrado como "Pendiente" en gestión RH
- **Rol afectado:** RH, Director, Gerente
- **Pantalla:** Gestión de Horas Extra — tabla y modal detalle
- **Descripción:** Solicitudes con una firma aprobada (`aprobado_parcial`) mostraban badge "Pendiente" porque la UI usaba `estado` persistido (`pendiente`) sin `estado_consolidado`.
- **Pasos para reproducir:**
  1. Crear solicitud de horas extra
  2. Aprobar solo como gerente regional (sin director)
  3. Abrir gestión RH
- **Resultado actual:** Badge "Pendiente"
- **Resultado esperado:** Badge "Aprobación parcial"
- **Severidad:** Alta
- **Archivo(s):** `app/schemas/horas_extra.py`, `app/services/horas_extra_service.py`, `frontend/src/nominas/horasExtra/components/horasExtraTableRows.ts`, `frontend/src/horasExtra/shared/renderHorasExtraDetalleModal.ts`
- **Estado:** corregido

### HE-002 — Registrador no veía estado parcial en tabla
- **Rol afectado:** Registrador
- **Pantalla:** Registro de Horas Extra — tabla de solicitudes
- **Descripción:** Mismo problema que HE-001 en la vista del registrador.
- **Pasos para reproducir:** Igual que HE-001, vista registrador
- **Resultado actual:** "Pendiente"
- **Resultado esperado:** "Aprobación parcial"
- **Severidad:** Media
- **Archivo(s):** `app/schemas/horas_extra_solicitud.py`, `app/services/horas_extra_solicitud_service.py`, `frontend/src/horasExtra/supervisor/renderHorasExtraSolicitudPage.ts`
- **Estado:** corregido

### HE-003 — Botón "Aprobar" visible sin permiso
- **Rol afectado:** Gerente Regional, Director
- **Pantalla:** Aprobación — modal detalle
- **Descripción:** Si `puede_aprobar=false` pero `puede_rechazar=true`, se mostraba botón Aprobar inactivo visualmente pero presente.
- **Pasos para reproducir:** Abrir solicitud ya resuelta por el aprobador actual
- **Resultado actual:** Ambos botones visibles
- **Resultado esperado:** Solo botones permitidos por API
- **Severidad:** Media
- **Archivo(s):** `frontend/src/horasExtra/shared/renderHorasExtraAprobacionDetalleModal.ts`
- **Estado:** corregido

### HE-004 — Modal de rechazo se abría sin `puede_rechazar`
- **Rol afectado:** Gerente Regional, Director
- **Pantalla:** Aprobación — modal detalle
- **Descripción:** Click en Rechazar no validaba `puede_rechazar` antes de abrir el modal de confirmación.
- **Pasos para reproducir:** Intentar rechazar solicitud ya resuelta
- **Resultado actual:** Abría modal de rechazo
- **Resultado esperado:** No abrir modal; backend ya bloqueaba pero UX confusa
- **Severidad:** Baja
- **Archivo(s):** `frontend/src/pages/horasExtraAprobaciones.ts`
- **Estado:** corregido

### HE-005 — Sin paginación en aprobaciones
- **Rol afectado:** Gerente Regional, Director
- **Pantalla:** Aprobación de Horas Extra — tabla
- **Descripción:** `page`/`pageSize` existían en estado pero no había controles UI; siempre página 1.
- **Pasos para reproducir:** Tener >10 solicitudes asignadas
- **Resultado actual:** Solo primeras 10 visibles sin navegación
- **Resultado esperado:** Paginación como en gestión RH
- **Severidad:** Media
- **Archivo(s):** `frontend/src/horasExtra/shared/renderHorasExtraAprobacionesPage.ts`, `frontend/src/pages/horasExtraAprobaciones.ts`
- **Estado:** corregido

### HE-006 — Columna mal etiquetada "Sucursal"
- **Rol afectado:** Gerente Regional, Director
- **Pantalla:** Aprobación — tabla
- **Descripción:** Columna "Sucursal" mostraba `subarea_descripcion`.
- **Pasos para reproducir:** Ver tabla de aprobaciones
- **Resultado actual:** Encabezado "Sucursal"
- **Resultado esperado:** "Subárea"
- **Severidad:** Baja
- **Archivo(s):** `frontend/src/horasExtra/shared/renderHorasExtraAprobacionesTable.ts`
- **Estado:** corregido

### HE-007 — Tests con fuga de datos entre casos
- **Rol afectado:** N/A (infraestructura)
- **Pantalla:** N/A
- **Descripción:** 7 tests fallaban en suite completa por datos residuales en SQLite compartido (commits vía API).
- **Pasos para reproducir:** `pytest tests/test_horas_extra.py tests/test_nominas_ajustes.py`
- **Resultado actual:** Fallos intermitentes por total incorrecto / aprobadores previos
- **Resultado esperado:** Aislamiento por test
- **Severidad:** Media (CI)
- **Archivo(s):** `tests/test_horas_extra.py`, `tests/test_nominas_ajustes.py`
- **Estado:** corregido

## 5. Correcciones aplicadas

1. **Backend:** Campo `estado_consolidado` en respuestas de listado RH, detalle y listado registrador; cálculo con `estado_consolidado()` existente; carga de `aprobaciones` en repositorio de solicitudes.
2. **Frontend:** Helper unificado `renderHorasExtraEstadoBadge()` en `horasExtraTableUi.ts` usado en gestión RH, aprobaciones y registro.
3. **Modal aprobación:** Botones condicionados a `puede_aprobar` / `puede_rechazar`; guard en handler de rechazo.
4. **Paginación:** Controles en vista de aprobaciones con `data-he-aprob-page`.
5. **OpenAPI:** Schemas actualizados con `estado_consolidado`.
6. **Tests:** Fixture autouse de limpieza + test `test_horas_extra_lista_expone_estado_consolidado_parcial`.

**Evidencia runtime (tests):** 48/48 tests pasando en módulos revisados:
```bash
docker-compose run --rm test pytest tests/test_horas_extra_aprobacion.py tests/test_horas_extra.py tests/test_horas_extra_solicitud_supervisor.py tests/test_nominas_ajustes.py
```

## 6. Bugs pendientes

### HE-P01 — KPIs de gestión RH ignoran filtros activos
- **Rol:** RH
- **Severidad:** Baja (diseño)
- **Descripción:** Tarjetas resumen siempre muestran totales globales del alcance, no de filtros/tab activos.
- **Estado:** pendiente (no corregido — posible comportamiento intencional)

### HE-P02 — Registrador sin acceso a historial
- **Rol:** Registrador
- **Severidad:** Baja
- **Descripción:** Puede ver `/estado` pero recibe 403 en `/historial`. Inconsistencia funcional documentada en tests.
- **Estado:** pendiente (requiere decisión de negocio)

### HE-P03 — Gerente puede acceder gestión RH por URL
- **Rol:** Gerente
- **Severidad:** Baja
- **Descripción:** `#/nominas/horas-extra` permitido en router para supervisor/gerente; backend filtra por alcance organizacional. Sin ítem de menú.
- **Estado:** pendiente (confirmar si es intencional)

### HE-P04 — Solicitudes sin aprobadores configurados
- **Rol:** RH
- **Severidad:** Media
- **Descripción:** Si no hay aprobadores activos, solicitudes quedan pendientes indefinidamente.
- **Estado:** pendiente (validación/configuración operativa)

### HE-P05 — KPI tabs vs resumen usan unidades distintas
- **Rol:** RH
- **Severidad:** Baja
- **Descripción:** Conteos de tabs (filas empleado) vs tarjetas (solicitudes) pueden no cuadrar.
- **Estado:** pendiente

## 7. Validaciones finales

| Check | Resultado |
|-------|-----------|
| Tests backend horas extra + ajustes | 48 passed |
| Regla aprobado final (GR + director) | Verificado en `test_horas_extra_aprobacion.py` |
| Rechazo sin comentario bloqueado | Backend 422 + frontend validación |
| Doble aprobación bloqueada | Test existente |
| Aprobación no asignada → 403 | Test existente |
| RH solo en ajustes | Test `test_aprobadores_solo_rh` |
| Registrador aislado | Test supervisor |
| `estado_consolidado` en listado RH | Test nuevo |

## 8. Riesgos o pendientes por confirmar

1. **Confirmar con negocio** si gerente regional debe ver gestión RH filtrada o solo aprobaciones.
2. **Confirmar** si registrador debe ver historial de firmas en detalle (hoy solo RH vía `/historial`).
3. **Validar en entorno real** notificaciones push/email para aprobadores con solicitudes pendientes (lógica backend presente; no verificado E2E en esta sesión).
