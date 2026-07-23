# Manejo de OPLs (One-Point Lessons) — Diseño

**Fecha:** 2026-07-23
**Sub-proyecto de:** Suite de Talento (activar el último placeholder de Aprendizaje)
**Rama:** `feat/cm/opls` → PR a `main`

## Contexto

`OPL` (`levelup_opls`) y `OPLVersion` (`levelup_opl_versiones`) son un placeholder
real: el modelo y los schemas Create/Update/Response **ya existen y las tablas
están migradas** (en `242b98b667ff`), pero **no hay service, router ni frontend**.
El módulo RH `opls` está registrado con `api_prefixes=()`. Este proyecto lo activa:
una biblioteca versionada de "lecciones de un punto" (documentos breves de
proceso/máquina, típicos de manufactura lean) con workflow de aprobación.

### Estado verificado en código

- `app/models/level_up.py`:
  - `EstadoAprobacionOPL`: `borrador`/`revision`/`aprobada`.
  - `OPL` (`levelup_opls`): `id`, `codigo` (String50, **unique**), `titulo`
    (String255), `proceso` (nullable), `maquina` (nullable), `aprobador_id`
    (FK `empleados`, nullable), `estado_aprobacion` (default `borrador`),
    `created_at`; relaciones `aprobador` y `versiones` (cascade all, delete-orphan).
  - `OPLVersion` (`levelup_opl_versiones`): `id`, `opl_id` (FK CASCADE),
    `version_num` (Integer), `archivo_url` (String500, requerido),
    `cambios_descripcion` (Text nullable), `fecha`, `creado_por_id` (FK `empleados`,
    nullable). `UniqueConstraint(opl_id, version_num)`.
- `app/schemas/level_up.py` L287-340: `OPLCreate` (`codigo`, `titulo`, `proceso?`,
  `maquina?`, `aprobador_id?`), `OPLUpdate` (`titulo?`, `proceso?`, `maquina?`,
  `aprobador_id?`, `estado_aprobacion?`), `OPLResponse`, `OPLVersionCreate`
  (`opl_id`, `version_num`, `archivo_url`, `cambios_descripcion?`, `creado_por_id?`),
  `OPLVersionResponse`.
- `app/core/rh_module_registry.py` L314-321: `RhModuleDef` `opls`, label "Manejo de
  OPLs", group **"Cumplimiento"**, `nav_item_ids=("opls",)`,
  `hash_prefixes=("#/opls",)`, `api_prefixes=()`.
- Patrón hermano recién construido: **Evidencias** (`feat/cm/evidencias-capacitacion`,
  PR #122): service con gestión RH + self-service, router bajo `level-up` con
  gestión RH-gated + self-service en `RH_SELF_SERVICE_API_PREFIXES`, frontend de
  gestión + vista self-service, `safeHref` para links externos. OPLs replica ese
  patrón.
- Sin service/router para `OPL`/`OPLVersion` (grep vacío).

## Decisiones aprobadas por el usuario

1. **Aprobador self-service.** RH crea la OPL (`borrador`) + versiones y la envía a
   revisión; el `aprobador_id` designado (self-service, id del token) la aprueba o
   la regresa a borrador.
2. **Versionado auto + reset** (recomendación aprobada en el diseño): `version_num`
   = max existente + 1 (automático); `creado_por_id` = token. **Agregar una versión
   resetea el estado a `borrador`** (el contenido cambió → requiere re-aprobación).
3. **Archivo = link externo** (sin infra de subida). Sin migración (tablas ya
   migradas). El "regresar" del aprobador no persiste motivo (el modelo no tiene
   campo de comentario; se comunica fuera del sistema).

## Arquitectura

Módulo nuevo de backend sobre modelos ya migrados. Sin migración. Service con
gestión (RH) + workflow de aprobación (self-service del aprobador); router bajo el
prefijo `level-up` con endpoints RH y self-service; frontend de gestión RH + vista
self-service "Mis aprobaciones". RH-gated (módulo `opls`); aprobar/regresar es
self-service del aprobador designado.

## Backend

### Schemas (`app/schemas/level_up.py`)

- `OPLVersionItem` (para embeber): `id`, `version_num`, `archivo_url`,
  `cambios_descripcion?`, `fecha`, `creado_por_id?`, `creado_por_nombre?`.
- `OPLConVersionesResponse`: los campos de `OPLResponse` + `aprobador_nombre?`,
  `versiones: list[OPLVersionItem]` (orden `version_num` desc), `version_actual?`
  (la de mayor `version_num`), `total_versiones: int`.
- `OPLVersionAgregar`: `archivo_url` (min 1, max 500), `cambios_descripcion?` (sin
  `version_num` ni `creado_por_id` — el service los resuelve).

### Service `app/services/opl_service.py`

```python
class OPLService:
    def __init__(self, db): ...

    # ── Gestión (RH) ──
    async def listar(self, codigo=None, estado=None, proceso=None, maquina=None
                     ) -> list[OPLConVersionesResponse]: ...
    async def obtener(self, opl_id) -> OPLConVersionesResponse: ...  # 404
    async def crear(self, data: OPLCreate) -> OPLConVersionesResponse:
        """codigo unico -> ConflictError 409 si ya existe. Valida aprobador_id
        (existe si viene) -> 404. Estado inicial 'borrador'."""
    async def actualizar(self, opl_id, data: OPLUpdate) -> OPLConVersionesResponse:
        """titulo/proceso/maquina/aprobador_id. Descarta estado_aprobacion (el
        estado se mueve por el workflow, no a mano). Valida aprobador_id si viene."""
    async def eliminar(self, opl_id) -> None: ...  # cascade borra versiones
    async def agregar_version(self, opl_id, data: OPLVersionAgregar, creado_por_id
                              ) -> OPLConVersionesResponse:
        """version_num = max(existentes)+1 (auto). creado_por_id = token. Resetea
        estado_aprobacion a 'borrador' (el contenido cambio)."""
    async def listar_versiones(self, opl_id) -> list[OPLVersionItem]: ...

    # ── Workflow ──
    async def enviar_a_revision(self, opl_id) -> OPLConVersionesResponse:
        """borrador -> revision. Exige >=1 version y aprobador_id designado
        (DomainValidationError 422 si falta). ConflictError si no esta en borrador."""

    # ── Aprobación (self-service del aprobador) ──
    async def aprobar(self, opl_id, aprobador_id) -> OPLConVersionesResponse:
        """revision -> aprobada. 403 si el token != aprobador_id de la OPL;
        409 si no esta en 'revision'."""
    async def regresar_a_borrador(self, opl_id, aprobador_id) -> OPLConVersionesResponse:
        """revision -> borrador. 403 si el token != aprobador_id; 409 si no en 'revision'."""
    async def mis_aprobaciones_pendientes(self, aprobador_id
                                          ) -> list[OPLConVersionesResponse]:
        """OPLs en 'revision' cuyo aprobador_id == token."""
```

`_to_response` embebe versiones + `version_actual` + `aprobador_nombre` (bulk
`get_nombres_por_empleado_ids` para aprobador y creadores). Estado siempre movido
por el workflow (nunca por `actualizar`).

### API — router `app/api/v1/opls/router.py`, prefijo `/api/v1/level-up/opls`

Las acciones del aprobador viven bajo el sub-prefijo estático
`/aprobaciones/...` para que un prefijo self-service las capture (el `opl_id`
va DESPUÉS del segmento estático, no antes — a diferencia de un `/{id}/aprobar`,
que no tendría prefijo estático capturable en `RH_SELF_SERVICE_API_PREFIXES`).

| Método | Ruta | Guard | Handler |
|---|---|---|---|
| GET | `/mis-aprobaciones` | `get_current_user` (self-service) | `mis_aprobaciones_pendientes` (token) |
| POST | `/aprobaciones/{opl_id}/aprobar` | `get_current_user` (self-service) | `aprobar` (token) |
| POST | `/aprobaciones/{opl_id}/regresar` | `get_current_user` (self-service) | `regresar_a_borrador` (token) |
| GET | `` (query `codigo?`,`estado?`,`proceso?`,`maquina?`) | `role_checker(["operativo"])` | `listar` |
| POST | `` | `role_checker(["operativo"])` | `crear` |
| GET | `/{opl_id}` | `role_checker(["operativo"])` | `obtener` |
| PUT | `/{opl_id}` | `role_checker(["operativo"])` | `actualizar` |
| DELETE | `/{opl_id}` | `role_checker(["operativo"])` | `eliminar` |
| POST | `/{opl_id}/versiones` | `role_checker(["operativo"])` | `agregar_version` (token = creador) |
| POST | `/{opl_id}/enviar-a-revision` | `role_checker(["operativo"])` | `enviar_a_revision` |

- **Orden de rutas**: las estáticas/self-service (`/mis-aprobaciones`,
  `/aprobaciones/...`) se declaran ANTES de `/{opl_id}` para que FastAPI no
  interprete `mis-aprobaciones`/`aprobaciones` como un `opl_id`. Las sub-rutas de
  gestión (`/{id}/versiones`, `/{id}/enviar-a-revision`) son literales tras el id,
  sin colisión.
- Registro: `include_router` en `main.py`; `api_prefixes` del `RhModuleDef["opls"]`
  a `("/api/v1/level-up/opls",)`; añadir a `RH_SELF_SERVICE_API_PREFIXES` los
  prefijos `"/api/v1/level-up/opls/mis-aprobaciones"` y
  `"/api/v1/level-up/opls/aprobaciones"` — así el aprobador no-RH pasa el
  middleware para ver/aprobar/regresar, mientras que la gestión
  (`/api/v1/level-up/opls`, otros paths) queda gated al módulo `opls`. Mismo
  patrón que Evidencias (`/firmas` self-service vs gestión gated).
- `openapi.yaml`. El aprobador siempre usa `current_user.empleado_id`.

## Frontend (design system — solo tokens de `uiTokens.ts`)

- **Gestión RH** `frontend/src/pages/opls.ts` (`#/opls`, nueva; ruta en
  `shellRouter.ts` con `.catch`): lista (código, título, proceso/máquina, estado
  con badge, nº de versiones, aprobador); crear/editar OPL (código, título,
  proceso, máquina, aprobador [selector de empleados]); gestión de versiones
  (agregar link + descripción → nueva versión, ver historial con `safeHref`);
  botón "Enviar a revisión". Api client `frontend/src/api/opls.ts`.
- **Self-service** `frontend/src/pages/misAprobaciones.ts` ("Mis aprobaciones"):
  el aprobador ve las OPLs en `revisión` que le tocan, abre la última versión
  (`safeHref`), y **Aprueba** o **Regresa a borrador**. Ruta `#/mis-aprobaciones-opl`
  en el menú del empleado (patrón self-service).
- XSS: `escapeHtml` + `safeHref` (solo http(s), rechaza `javascript:`/`data:`/
  protocolo-relativo) en los links.

## Testing

- **Service:** `codigo` duplicado → 409; `agregar_version` auto-incrementa
  `version_num` (1, 2, 3…) y resetea el estado a `borrador`; `enviar_a_revision`
  exige ≥1 versión + aprobador (422 si falta) y solo desde `borrador` (409);
  `aprobar`/`regresar` solo el aprobador designado (403 ajeno) y solo desde
  `revisión` (409); `mis_aprobaciones_pendientes` solo las del token en `revisión`;
  eliminar borra versiones (cascade); flujo completo borrador→revisión→aprobada.
- **API:** 200 RH; 403 gestión sin módulo; self-service `/mis-aprobaciones` y
  `/{id}/aprobar` accesibles por el aprobador (token); aprobar OPL ajena → 403.
- **Regresión:** suite completa sin fallos.
- Frontend: `npm run build` limpio + `npm run test` verde.

## Riesgos / trade-offs

- **Sin upload:** `archivo_url` es link externo por versión; guard `safeHref` en la
  UI. No se verifica accesibilidad de la URL.
- **Reset a borrador al versionar:** una OPL aprobada vuelve a `borrador` al subir
  una nueva versión; es intencional (control de documentos: contenido nuevo →
  re-aprobación).
- **Regresar sin motivo:** el modelo no tiene campo de comentario de rechazo; el
  aprobador comunica el motivo fuera del sistema (follow-up: agregar `comentario`
  requeriría migración).
- **Aprobador sin cuenta:** el flujo self-service exige que el aprobador tenga
  acceso; un aprobador de piso sin cuenta no puede aprobar (aceptable: el aprobador
  suele ser supervisor/ingeniería).
- **Estado no editable a mano:** `actualizar` descarta `estado_aprobacion`; el
  estado solo se mueve por el workflow.

## Decomposición en tareas (para el plan)

1. Schemas: `OPLVersionItem`, `OPLConVersionesResponse`, `OPLVersionAgregar`.
2. Service — gestión RH (CRUD OPL + versiones con auto-incremento + reset). Tests.
3. Service — workflow (`enviar_a_revision`) + aprobación self-service
   (`aprobar`/`regresar`/`mis_aprobaciones_pendientes`). Tests.
4. Router + registro (`api_prefixes` + self-service prefix) + `openapi.yaml`. Tests API.
5. Frontend — gestión RH (`opls.ts` + api client + ruta).
6. Frontend — self-service (`misAprobaciones.ts` + aprobar/regresar).
7. Cierre de huecos de cobertura.
