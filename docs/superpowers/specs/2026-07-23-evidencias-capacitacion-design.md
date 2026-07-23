# Motor de Evidencias de Capacitación + Firmas — Diseño

**Fecha:** 2026-07-23
**Sub-proyecto de:** Suite de Talento (activar placeholder de Aprendizaje)
**Rama:** `feat/cm/evidencias-capacitacion` → PR a `main`

## Contexto

`EvidenciaCapacitacion` (`levelup_evidencias_capacitacion`) y `EvidenciaFirma`
(`levelup_evidencia_firmas`) son un placeholder real: el modelo y los schemas
Create/Update/Response **ya existen y las tablas están migradas** (en
`242b98b667ff_level_up_fase_b0_modelado.py`), pero **no hay service, router ni
frontend**. El módulo RH `evidencias` está registrado con `api_prefixes=()`. Este
proyecto activa el placeholder: RH sube evidencias de que un empleado se capacitó
(link a un documento/foto) y asigna firmantes; cada firmante firma o rechaza; el
estado de la evidencia se deriva de las firmas.

### Estado verificado en código

- `app/models/level_up.py`:
  - `TipoEvidencia`: `foto`/`documento`/`video`/`firma`.
  - `EstadoEvidencia`: `pendiente`/`validada`/`devuelta`.
  - `EstadoFirma`: `pendiente`/`firmada`/`rechazada`.
  - `EvidenciaCapacitacion` (`levelup_evidencias_capacitacion`): `id`, `tipo`,
    `archivo_url` (String500, requerido), `capacitacion_id` (FK
    `levelup_capacitaciones`, nullable), `empleado_id` (FK `empleados`), `estado`
    (default `pendiente`), `fecha_subida`, `notas`; relación `firmas` (cascade
    all, delete-orphan).
  - `EvidenciaFirma` (`levelup_evidencia_firmas`): `id`, `evidencia_id` (FK CASCADE),
    `firmante_id` (FK `empleados`), `rol_firma` (String100), `estado` (default
    `pendiente`), `fecha_firma` (nullable), `comentario`. `UniqueConstraint
    (evidencia_id, firmante_id, rol_firma)`.
- `app/schemas/level_up.py` L343-401: `EvidenciaCapacitacionCreate` (`tipo`,
  `archivo_url`, `capacitacion_id?`, `empleado_id`, `notas?`),
  `EvidenciaCapacitacionUpdate` (`estado?`, `notas?`),
  `EvidenciaCapacitacionResponse`, `EvidenciaFirmaCreate` (`evidencia_id`,
  `firmante_id`, `rol_firma`), `EvidenciaFirmaUpdate` (`estado?`, `comentario?`),
  `EvidenciaFirmaResponse`.
- `app/core/rh_module_registry.py` L322-329: `RhModuleDef` `evidencias`, label
  "Motor de Evidencias", group **"Cumplimiento"**, `nav_item_ids=("evidencias",)`,
  `hash_prefixes=("#/evidencias",)`, `api_prefixes=()`.
- `RH_SELF_SERVICE_API_PREFIXES` (L424+): patrón `"/api/v1/<mod>/mis-*"` (ej.
  `encuestas-rh/mis-encuestas`, `metas/mis-metas`).
- `Capacitacion` (`levelup_capacitaciones`, `app/models/talento.py:328`) para el
  selector de capacitación; empleados vía los selectores existentes.
- Sin service/router para `EvidenciaCapacitacion`/`EvidenciaFirma` (grep vacío).

## Decisiones aprobadas por el usuario

1. **RH sube, firmas derivan el estado.** RH sube la evidencia (link + empleado +
   capacitación) y asigna los firmantes requeridos. La evidencia se marca
   `validada` cuando TODAS las firmas están `firmada`, y `devuelta` si alguna se
   `rechaza`; si no, `pendiente`.
2. **Self-service del firmante.** Cada firmante firma/rechaza SU propia fila con su
   cuenta (`firmante_id` del token). RH no firma por otros.
3. **Archivo = link externo** (el modelo fija `archivo_url` String; no hay infra de
   subida). Sin migración (tablas ya migradas). `rol_firma` texto libre (la UI
   sugiere `empleado`/`instructor`/`jefe`).
4. **Firmantes asignables al crear** (lista opcional en el create) y agregables/
   quitables después.

## Arquitectura

Módulo nuevo de backend sobre modelos ya migrados. Sin migración. Service con
gestión (RH) + firma (self-service) + derivación de estado; router bajo el prefijo
`level-up` con endpoints RH y self-service; frontend de gestión RH + vista
self-service "mis firmas". RH-gated (módulo `evidencias`); la firma es self-service.

## Regla de derivación del estado (núcleo)

`_recalcular_estado(evidencia)` tras cada firma o cambio de firmantes:
- Si **alguna** firma está `rechazada` → evidencia `devuelta`.
- Si hay **≥1** firma y **todas** están `firmada` → `validada`.
- En cualquier otro caso (hay firmas `pendiente`, o no hay firmas) → `pendiente`.

El estado de la evidencia NO se setea a mano (el `estado` de
`EvidenciaCapacitacionUpdate` no se expone en la API de RH; RH solo edita
`archivo_url`/`notas`). Quitar una firma rechazada puede revalidar → se recalcula.

## Backend

### Schemas (`app/schemas/level_up.py`)

- `EvidenciaFirmaItem` (para embeber): `id`, `firmante_id`, `firmante_nombre?`,
  `rol_firma`, `estado`, `fecha_firma?`, `comentario?`.
- `EvidenciaConFirmasResponse`: los campos de `EvidenciaCapacitacionResponse` +
  `empleado_nombre?`, `capacitacion_nombre?`, `firmas: list[EvidenciaFirmaItem]`,
  y un resumen `firmas_total`/`firmas_firmadas` (para el progreso en la UI).
- `FirmanteAsignar`: `firmante_id: int`, `rol_firma: str` (min_length 1, max 100).
- `EvidenciaCrearRequest`: los campos del `Create` + `firmantes:
  list[FirmanteAsignar] = []` (opcional).
- `FirmarRequest`: `estado: Literal["firmada", "rechazada"]`, `comentario:
  Optional[str]`.

### Service `app/services/evidencia_capacitacion_service.py`

```python
class EvidenciaCapacitacionService:
    def __init__(self, db): ...

    # ── Gestión (RH) ──
    async def listar(self, empleado_id=None, capacitacion_id=None, estado=None
                     ) -> list[EvidenciaConFirmasResponse]: ...
    async def obtener(self, evidencia_id) -> EvidenciaConFirmasResponse: ...  # 404
    async def crear(self, data: EvidenciaCrearRequest) -> EvidenciaConFirmasResponse:
        """Valida empleado_id (existe) y capacitacion_id (existe si viene) -> 404.
        Crea la evidencia (estado pendiente) y las filas de firma pendientes por
        cada firmante. Recalcula estado."""
    async def actualizar(self, evidencia_id, data: EvidenciaCapacitacionUpdate
                         ) -> EvidenciaConFirmasResponse:
        """Solo archivo_url/notas (el estado es derivado; ignora `estado` del schema)."""
    async def eliminar(self, evidencia_id) -> None: ...  # cascade borra firmas
    async def agregar_firmante(self, evidencia_id, data: FirmanteAsignar
                               ) -> EvidenciaConFirmasResponse:
        """Crea una firma pendiente (respeta el unique evidencia+firmante+rol).
        Recalcula estado (agregar un pendiente puede quitar 'validada')."""
    async def quitar_firmante(self, firma_id) -> EvidenciaConFirmasResponse:
        """Borra la fila de firma; recalcula el estado de su evidencia."""

    # ── Firma (self-service del firmante) ──
    async def mis_firmas_pendientes(self, firmante_id
                                    ) -> list[EvidenciaConFirmasResponse]:
        """Evidencias con una firma `pendiente` cuyo firmante_id == token."""
    async def firmar(self, firma_id, firmante_id, data: FirmarRequest
                     ) -> EvidenciaConFirmasResponse:
        """Valida que la firma existe (404), pertenece al firmante del token
        (403 si no), y está `pendiente` (409 si ya firmada/rechazada). Setea
        estado firmada|rechazada, fecha_firma=ahora, comentario. Recalcula el
        estado de la evidencia."""

    async def _recalcular_estado(self, evidencia) -> None:  # regla de derivación
```

### API — router `app/api/v1/evidencias/router.py`, prefijo `/api/v1/level-up/evidencias`

| Método | Ruta | Guard | Handler |
|---|---|---|---|
| GET | `` (query `empleado_id?`,`capacitacion_id?`,`estado?`) | `role_checker(["operativo"])` | `listar` |
| POST | `` | `role_checker(["operativo"])` | `crear` |
| GET | `/{id}` | `role_checker(["operativo"])` | `obtener` |
| PUT | `/{id}` | `role_checker(["operativo"])` | `actualizar` |
| DELETE | `/{id}` | `role_checker(["operativo"])` | `eliminar` |
| POST | `/{id}/firmantes` | `role_checker(["operativo"])` | `agregar_firmante` |
| DELETE | `/firmantes/{firma_id}` | `role_checker(["operativo"])` | `quitar_firmante` |
| GET | `/mis-firmas` | `get_current_user` (self-service) | `mis_firmas_pendientes` (token) |
| POST | `/firmas/{firma_id}/firmar` | `get_current_user` (self-service) | `firmar` (token) |

- Registro: `include_router` en `app/main.py`; poblar `api_prefixes` del
  `RhModuleDef["evidencias"]` a `("/api/v1/level-up/evidencias",)`; añadir
  `"/api/v1/level-up/evidencias/mis-firmas"` y
  `"/api/v1/level-up/evidencias/firmas"` a `RH_SELF_SERVICE_API_PREFIXES` (para que
  el firmante no-RH pueda firmar). `openapi.yaml`.
- El firmante siempre usa `current_user.empleado_id` — nunca un id del body.

## Frontend (design system — solo tokens de `uiTokens.ts`)

- **Gestión RH** `frontend/src/pages/evidencias.ts` (`#/evidencias`, nueva; ruta en
  `shellRouter.ts` con `.catch`): lista de evidencias (empleado, capacitación, tipo,
  link, estado con badge, y **progreso de firmas** X/N); modal de crear evidencia
  (tipo, `archivo_url`, empleado [selector], capacitación [selector opcional], notas,
  firmantes [empleado + rol, agregar varios]); ver detalle con las firmas y su
  estado; agregar/quitar firmante; editar link/notas; eliminar (confirmación).
  Api client `frontend/src/api/evidencias.ts`.
- **Self-service** `frontend/src/pages/misFirmas.ts` ("Mis firmas pendientes"): el
  firmante ve las evidencias que debe firmar (link abrible, contexto: empleado/
  capacitación/notas) y **firma o rechaza** con comentario. Ruta self-service en el
  menú del empleado.
- Reusar selectores de empleados/capacitaciones existentes. XSS: `escapeHtml` en
  notas/comentarios/nombres/link.

## Testing

- **Service:** crear evidencia con firmantes (estado `pendiente`); `firmar` todas →
  evidencia `validada`; una `rechazada` → `devuelta`; quitar la firma rechazada →
  recalcula; `firmar` una firma ajena (token ≠ firmante) → 403; firmar una ya
  firmada → 409; empleado/capacitación inexistentes → 404; `mis_firmas_pendientes`
  solo devuelve las del token en `pendiente`.
- **API:** 200 RH; 403 sin módulo en la gestión; self-service `/mis-firmas` y
  `/firmas/{id}/firmar` accesibles por el firmante (token), y un firmante no puede
  firmar la fila de otro (403).
- **Regresión:** suite completa sin fallos.
- Frontend: `npm run build` limpio + `npm run test` verde.

## Riesgos / trade-offs

- **Sin upload:** `archivo_url` es un link externo; validar formato mínimo (no
  vacío, longitud) — no se verifica que la URL sea accesible.
- **Derivación en cada cambio:** recalcular el estado tras cada firma/alta/baja de
  firmante mantiene la consistencia; barato (una consulta de firmas por evidencia).
- **Firmante sin cuenta:** el flujo self-service exige que el firmante tenga acceso;
  operadores de piso sin cuenta quedan fuera (decisión del usuario: self-service).
  Un futuro modo "RH registra la firma" es follow-up, no v1.
- **`rol_firma` libre:** flexible; la UI sugiere valores comunes sin forzarlos.
- **Estado no editable a mano:** evita divergencia entre el estado y las firmas.

## Decomposición en tareas (para el plan)

1. Schemas: `EvidenciaFirmaItem`, `EvidenciaConFirmasResponse`, `FirmanteAsignar`,
   `EvidenciaCrearRequest`, `FirmarRequest`. (+ función pura de derivación de estado
   si conviene aislarla.)
2. Service — gestión RH (CRUD evidencias + firmantes) + `_recalcular_estado`. Tests.
3. Service — self-service (`mis_firmas_pendientes`, `firmar`) + derivación al firmar.
   Tests.
4. Router + registro (`api_prefixes` + self-service prefix) + `openapi.yaml`. Tests API.
5. Frontend — gestión RH (`evidencias.ts` + api client + ruta/nav).
6. Frontend — self-service (`misFirmas.ts` + firmar/rechazar).
7. Cierre de huecos de cobertura.
