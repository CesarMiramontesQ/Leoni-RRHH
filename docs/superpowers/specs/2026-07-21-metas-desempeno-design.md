# Spec de diseño — Módulo Metas (primer sub-proyecto de Desempeño)

Fecha: 2026-07-21 · Rama: `feat/cm/metas-desempeno` · Estado: aprobado para plan

## Contexto y motivación

La visión de suite de talento incluye un módulo de **Desempeño** (OKR/metas, evaluaciones 360°, 9-box, ciclos). Una exploración exhaustiva del repo mostró que la mayor parte de ese dominio **ya existe**:

- **Evaluación 360°** completa por campañas (`levelup_eval360_*`, `app/api/v1/evaluacion360/`, `app/services/evaluacion360_service.py`): escalas, multi-evaluador con pesos, plantillas, participantes, recordatorios, exports PDF/Excel.
- **9-box** completo dentro de Eval360 (`get_9box`/`set_9box`, ejes desempeño vs potencial).
- **PDI** (plan de desarrollo individual): `PlanDesarrolloIndividual` en `app/models/talento.py`, CRUD/workflow/heatmap/timeline/KPIs en `app/services/pdi_service.py`, módulo `pdi-gestion`.
- **Evaluación de competencias por empleado** con workflow (módulo `evaluaciones`, `EvaluacionCompetencia`).
- **Competencias ↔ puesto ↔ empleado** completo (`app/models/talento.py`).
- **Historial objetivo por empleado** ya centralizado en la tabla `incidencias` (ETL de calidad/seguridad/evaluación de productividad del bono) + **vista 360** base (`GET /api/v1/empleados/{id}/vista360`).

Lo **genuinamente nuevo** es el subsistema de **Metas / Objetivos (estilo OKR)**, que hoy no existe (0 ocurrencias de goals/OKR/key-results en `app/`). Por eso este primer sub-proyecto de Desempeño se acota a **Metas**. Los demás pedazos (orquestador de ciclo unificado, cruce con historial objetivo en la evaluación, extensión de vista360) quedan como sub-proyectos posteriores, cada uno con su propio ciclo spec→plan→implementación.

## Decisiones aprobadas por el usuario

1. **Modelo OKR ligero**: cada meta (objetivo cualitativo) tiene 1+ **resultados clave medibles** con valor objetivo/actual; el avance % se calcula solo. La meta lleva un **peso**. Sin cascada estricta multinivel.
2. **Ciclos configurables por RH** (nombre + fechas); cada meta pertenece a un ciclo.
3. **Asignación top-down**: el jefe (o RH) crea y asigna metas al empleado (sin paso de propuesta del empleado).
4. **Individual + enlace opcional a meta de equipo/área** (roll-up de avance del equipo); sin cascada estricta de 4 niveles.
5. **Seguimiento**: el empleado actualiza el valor actual de cada resultado clave (avance recalculado) con notas de check-in; el jefe puede ajustar/comentar.
6. **Cierre**: el jefe **califica el cumplimiento por meta**; el sistema calcula un **cumplimiento de metas % ponderado**, expuesto para alimentar 9-box/desempeño en un sub-proyecto futuro.

## Alcance

**Dentro:** ciclos de metas, metas individuales y de equipo con resultados clave medibles, seguimiento con check-ins, cierre con calificación y cumplimiento ponderado, gestión por jefe con scoping de equipo, self-service del empleado, recordatorios, y exports básicos.

**Fuera (sub-proyectos posteriores):** orquestador de ciclo de desempeño unificado (metas + 360 + competencias); cruce del historial objetivo (incidencias/faltas/actas/bono) en la evaluación; extensión de `vista360` para mostrar metas/desempeño; integración automática del cumplimiento en el eje "desempeño" del 9-box (solo se **expone** el score, no se conecta aún).

## Arquitectura y encaje

- Backend en capas del repo: router → service → repository → models/schemas. Módulo nuevo `metas`.
- **Reúsa** (no reconstruye): `NotificacionService` (asignación + recordatorios), APScheduler (job diario, patrón `_eval360_recordatorios_job`), export PDF/Excel (patrón `evaluacion360_service`), **scoping por equipo** (`gestor_team_role_checker` / patrón `pdi progreso-equipo`), y el design system + tokens compartidos (`frontend/src/ui/uiTokens.ts`, incluidos los helpers nuevos `renderTabNav`/`skeletonBlock`/`errorState`/`alertInfo`).
- Regla dura del repo: tablas nuevas con prefijo `levelup_`; nada de DDL sobre tablas externas; `openapi.yaml` sincronizado; frontend solo con tokens del design system.

## Modelo de datos (`levelup_meta_*`, nuevo `app/models/metas.py`)

- **`levelup_meta_ciclo`** (`MetaCiclo`): `id`; `nombre`; `descripcion` (nullable); `fecha_inicio` (Date); `fecha_fin` (Date); `estado` ("borrador"|"activo"|"cerrado"); `creado_por_id` (FK empleados); timestamps. Un ciclo agrupa metas y define la ventana de captura/cierre.
- **`levelup_meta`** (`Meta`): `id`; `ciclo_id` (FK CASCADE); `nivel` ("individual"|"equipo"); `empleado_id` (FK empleados, nullable — requerido si individual); `area_id` (FK, nullable) y `lider_id` (FK empleados, nullable) — para nivel equipo; `titulo`; `descripcion` (nullable); `peso` (Numeric, 0–100); `estado` ("asignada"|"en_progreso"|"cerrada"); `meta_padre_id` (FK self, nullable — enlace opcional a una meta nivel "equipo"); `asignada_por_id` (FK empleados, el jefe/RH); `calificacion_cierre` (Numeric nullable, 0–100); `comentario_cierre` (nullable); timestamps. Índices: `(ciclo_id, empleado_id)`, `(ciclo_id, nivel)`, `(meta_padre_id)`.
- **`levelup_meta_resultado_clave`** (`MetaResultadoClave`): `id`; `meta_id` (FK CASCADE); `orden`; `titulo`; `tipo_metrica` ("numero"|"porcentaje"|"booleano"|"moneda"); `unidad` (nullable); `direccion` ("subir"|"bajar"); `valor_inicial` (Numeric); `valor_objetivo` (Numeric); `valor_actual` (Numeric); timestamps. El avance % se deriva (no se almacena) — ver fórmula.
- **`levelup_meta_checkin`** (`MetaCheckin`): `id`; `resultado_clave_id` (FK CASCADE); `autor_id` (FK empleados); `valor_registrado` (Numeric); `nota` (Text nullable); `es_ajuste_jefe` (Boolean, default False); `created_at`. Historial inmutable de actualizaciones de avance.

Relaciones ORM: `MetaCiclo.metas`, `Meta.resultados_clave` (order_by orden, cascade delete-orphan), `MetaResultadoClave.checkins`, `Meta.meta_padre`/`submetas`.

Migración Alembic: solo `create_table` de `levelup_meta_*`; `down_revision` = head único actual (verificar). No autogenerate contra la BD real.

## Fórmula de avance y cumplimiento (en el service)

- **Avance de un resultado clave** (clamp 0–100):
  - `booleano`: 0 o 100.
  - dirección `subir`: `(actual − inicial) / (objetivo − inicial)`.
  - dirección `bajar`: `(inicial − actual) / (inicial − objetivo)`.
  - denominador 0 (objetivo == inicial) → definir como 100 si actual cumple, si no 0; documentar el borde.
- **Avance de una meta**: promedio simple de sus resultados clave (documentar; ponderación de RC queda fuera del MVP).
- **Cumplimiento de metas % del empleado en el ciclo** (al cierre): `Σ(peso_i × calificacion_cierre_i) / Σ(peso_i)` sobre las metas cerradas del empleado. El **avance** (derivado de RC) es la señal de seguimiento durante el ciclo; la **calificación** del jefe es el juicio de cierre. Ambos se exponen; el cumplimiento ponderado es el score que un futuro 9-box/desempeño podrá consumir.
- **Roll-up de meta de equipo**: avance = promedio del avance de sus `submetas` (metas individuales enlazadas por `meta_padre_id`); si la meta de equipo tiene RC propios, se documenta cuál manda (propuesta: si tiene RC propios, usa RC; si no, roll-up de submetas).

## Ciclo de vida y validaciones

- **Ciclo**: borrador → activo (permite asignar/actualizar) → cerrado (congela; calcula cumplimiento). Solo metas de ciclos activos se editan/actualizan.
- **Meta**: asignada → en_progreso (al primer check-in) → cerrada (al cerrar el ciclo o manualmente por el jefe, con calificación). Peso total por empleado en un ciclo: advertir si Σpeso ≠ 100 (no bloquear en MVP; documentar).
- Validaciones: meta individual exige `empleado_id`; meta equipo exige `area_id`/`lider_id`; `meta_padre_id` solo puede apuntar a una meta nivel "equipo" del mismo ciclo; RC con `valor_objetivo` ≠ `valor_inicial` salvo booleano; calificación 0–100.
- Errores con las excepciones del repo: estado inválido → `ConflictError` (409); input inválido → `DomainValidationError` (422); no encontrado → `NotFoundError` (404). (Patrón ya usado en encuestas-rh.)

## API (`app/api/v1/metas/router.py`, prefijo `/api/v1/metas`)

Gestión (jefe con scoping de equipo + RH por módulo):
- Ciclos: `GET/POST /ciclos`, `GET/PUT /ciclos/{id}`, `POST /ciclos/{id}/activar`, `POST /ciclos/{id}/cerrar`.
- Metas: `GET /metas?ciclo_id=&empleado_id=&nivel=`, `POST /metas`, `GET/PUT/DELETE /metas/{id}` (DELETE solo si sin check-ins), `POST /metas/{id}/cerrar` (body: calificación + comentario).
- Resultados clave: `POST /metas/{id}/resultados`, `PUT/DELETE /metas/{id}/resultados/{rc_id}`.
- Ajuste de avance por el jefe: `POST /resultados/{rc_id}/checkin` (con `es_ajuste_jefe`).
- Equipo: `GET /equipo/avance?ciclo_id=` (tablero de avance del equipo del jefe), `GET /empleados/{id}/cumplimiento?ciclo_id=` (score ponderado).
- Export: `GET /ciclos/{id}/export/excel` (patrón Eval360).

Self-service (empleado, agregar `/api/v1/metas/mis-metas` a `RH_SELF_SERVICE_API_PREFIXES`; empleado_id del token):
- `GET /mis-metas?ciclo_id=`, `GET /mis-metas/{id}`, `POST /mis-metas/resultados/{rc_id}/checkin` (actualiza valor_actual + nota; genera check-in).

Capas: `app/schemas/metas.py`, `app/repositories/metas_repository.py` (agregaciones de avance/cumplimiento en SQL donde convenga), `app/services/metas_service.py`. Registrar en `app/main.py` e insertar entrada en `RH_MODULES` (`app/core/rh_module_registry.py`): key `metas`, label "Metas", grupo "Talento", `api_prefixes=("/api/v1/metas",)`, `hash_prefixes=("#/talento/metas",)`. Actualizar `openapi.yaml`.

## Permisos y scoping

- Módulo `metas` (RH) para gestión global.
- Jefes/supervisores: scoping por equipo (`lider_id`) reutilizando `gestor_team_role_checker` / el patrón de `pdi progreso-equipo` — un jefe solo ve/gestiona metas de su equipo. Verificar el mecanismo real en `app/core/dependencies.py` y replicarlo (no reinventar).
- Self-service del empleado sin requerir módulo; siempre usa el `empleado_id` del token (nunca del cliente).

## Recordatorios

Job diario APScheduler (`_metas_recordatorios_job` en `app/main.py`, patrón `_eval360_recordatorios_job`): notifica próximos cierres de ciclo y metas sin actualizar hace N días. `NotificacionService.enviar(...)` con target `#/talento/mis-metas`.

## Frontend (`frontend/src/`, design system)

- API client `frontend/src/api/metas.ts` (types sincronizados con schemas).
- Página gestión `frontend/src/pages/metas.ts` (`#/talento/metas`): ciclos; asignar metas al equipo con sus resultados clave; tablero de avance del equipo (barras de avance, `tabular-nums`); cerrar ciclo y calificar metas. Reusar `pageHeading`, `renderTabNav`, `skeletonBlock`, `errorState`, `renderEmptyState`, badges.
- Página empleado `frontend/src/pages/misMetas.ts` (`#/talento/mis-metas`): metas asignadas por ciclo; actualizar valor actual de cada RC (avance recalculado en vivo) + nota de check-in; historial de check-ins; ver calificación al cierre.
- Router `shellRouter.ts` (ramas `#/talento/metas` y `#/talento/mis-metas`, sin colisión), nav en `talentoNav.ts` + `shellNavPolicy.ts` (ítem gestión gated por módulo; "mis metas" visible a empleado/supervisor), y ítem "Mis metas" en `empleadoNav.ts`/`supervisorNav.ts`.

## Testing (SQLite in-memory, factories de conftest)

- **Cálculo de avance** por tipo de métrica y dirección (subir/bajar/booleano), con bordes (denominador 0, clamp 0–100).
- **Cumplimiento ponderado** al cierre (Σ peso×calificación / Σ peso) y roll-up de meta de equipo.
- **Ciclo de vida**: no editar metas de ciclo cerrado (409); cerrar ciclo congela y calcula; primer check-in pasa meta a en_progreso.
- **Scoping por equipo**: un jefe no ve/gestiona metas de otro equipo (403/scope vacío); RH con módulo sí.
- **Self-service**: empleado actualiza sus RC (check-in) pero no puede gestionar ciclos ni calificar; usa empleado_id del token (ignora body).
- **Recordatorios**: con `NotificacionService` mockeado.
- Export Excel: 200 + content-type; contenido básico.

## Verificación end-to-end

- `docker-compose run --rm test pytest tests/test_metas_*.py` y suite completa sin regresiones.
- `docker-compose exec frontend npm run build` limpio + `npm run test` verde.
- Manual: RH crea ciclo y lo activa → jefe asigna una meta con 2 RC a un empleado de su equipo → empleado actualiza avance (check-ins) → jefe cierra el ciclo y califica → verificar cumplimiento ponderado y tablero de equipo → export Excel.

## Riesgos / decisiones abiertas menores

- **Peso total ≠ 100%**: advertir, no bloquear (MVP). Reconsiderar si se requiere validación dura.
- **Meta de equipo con RC propios vs roll-up de submetas**: propuesta = si tiene RC propios manda RC; si no, roll-up. Confirmar en implementación.
- **Cumplimiento durante el ciclo (sin calificación)**: mostrar avance derivado; el cumplimiento oficial es al cierre con calificación del jefe.
- **Desanonimización / privacidad**: no aplica (metas son nominales por diseño).
