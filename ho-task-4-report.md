# Tarea 4 — HistorialObjetivoService — Reporte

## Estado
DONE

## Commit
`11f1cba` — `feat(historial-objetivo): agregar HistorialObjetivoService (indice + desglose por empleado y equipo)`
(un solo commit atómico: `app/services/historial_objetivo_service.py` + `tests/test_historial_objetivo_service.py`)

## Archivo creado
`app/services/historial_objetivo_service.py`

## Firmas públicas EXACTAS (para T5)

```python
class HistorialObjetivoService:
    def __init__(self, db: AsyncSession) -> None: ...

    async def indice_empleado(
        self,
        current_user: Empleado,
        empleado_id: int,
        fecha_inicio: date | None,
        fecha_fin: date | None,
        rh_ui_mode: str | None = None,
    ) -> HistorialObjetivoResponse: ...

    async def indice_equipo(
        self,
        current_user: Empleado,
        fecha_inicio: date | None,
        fecha_fin: date | None,
        rh_ui_mode: str | None = None,
    ) -> HistorialObjetivoEquipoResponse: ...

    # Firmas-espejo fase 2 (sin conectar a ningún endpoint/consumidor todavía;
    # listas para Ciclo de Desempeño):
    async def indice_historial_empleado(
        self, empleado_id: int, fecha_inicio: date | None, fecha_fin: date | None
    ) -> float: ...

    async def indice_historial_empleado_o_none(
        self, empleado_id: int, fecha_inicio: date | None, fecha_fin: date | None
    ) -> float | None: ...
```

### Estructuras devueltas (dataclasses propias del service, no Pydantic)

```python
@dataclass(frozen=True)
class HistorialObjetivoResponse:
    empleado_id: int
    resultado: ResultadoIndiceObjetivo   # de app.services.historial_objetivo.types (Tarea 1)
    bono_disponible: bool                # False si BONO_DB_* no está configurado (degradación)

@dataclass(frozen=True)
class HistorialObjetivoEquipoItem:
    empleado_id: int
    no_empleado: str | None
    nombre: str | None
    resultado: ResultadoIndiceObjetivo

@dataclass(frozen=True)
class HistorialObjetivoEquipoResponse:
    items: tuple[HistorialObjetivoEquipoItem, ...]   # ordenado peor-índice primero
    bono_disponible: bool
```

`ResultadoIndiceObjetivo` (de T1) trae `.indice`, `.semaforo`, `.penalizacion_total`, `.desglose` (tupla de 4 `DesgloseFuente`, orden actas/faltas/incidencias/progresivo, siempre presentes).

**Decisión schemas vs dataclasses**: el service devuelve dataclasses propias (no Pydantic). T5 debe mapear estas estructuras a los schemas HTTP de respuesta. Mantiene el service desacoplado de la capa HTTP, igual que el paquete puro de T1.

## Decisiones clave

- **Bono no configurado** (`BonoProductividadReadClient.create_read_engine()` → `None`): degradación con gracia, NO se lanza excepción. El índice se calcula solo con actas; `bono_disponible=False` en la respuesta (tanto en `HistorialObjetivoResponse` como en `HistorialObjetivoEquipoResponse`). Se loguea un `WARNING` explícito. Verificado con test dedicado (acta signed=15 → índice 85/verde, límite exacto).
- **Engine único de bono**: `_agregar_bono()` abre UN engine (`create_read_engine()`), instancia AMBOS repos (`BonoHistoricoIncidenciasRepository` + `BonoFaltasRetardosRepository`) sobre ese mismo engine, y hace `await engine.dispose()` en `finally` (se ejecuta incluso si una de las dos agregaciones lanza `SQLAlchemyError`, que se traduce a `ServiceUnavailableError`). Verificado con tests que aseguran `create_read_engine` llamado una sola vez y `dispose` awaited una sola vez, incluso en el camino de error.
- **Tipos/códigos desconocidos** (nota de revisión del brief): `_conteos_fuente_filtrados()` valida cada clave contra `PESOS_POR_FUENTE[fuente]` antes de construir el `ConteosFuente`; lo que no pertenece se descarta y se loguea con `logger.warning` (mensaje incluye el tipo/código y la fuente). Igual para códigos de ponderación de faltas no mapeados en `CODIGO_PONDERACION_A_TIPO` (`_faltas_conteos_por_codigo_a_tipo`). Esto es una capa explícita ANTES de que `formula._desglose_fuente` (T1) aplique su propio "peso 0 implícito" — así un tipo nuevo/corrupto en la BD externa queda visible en logs en vez de solo no penalizar en silencio.
- **Progresivo**: siempre `ConteosFuente()` vacío (sin agregador en v1, per T1). Verificado con test dedicado.
- **`indice_equipo` — scope delimitado (supervisor/gerente/empleado)**: usa el `scope_ids` de T3 directamente como universo del ranking (no solo la unión de empleados con eventos) — así un empleado con historial limpio (índice 100) también aparece en el ranking del equipo, no solo los que tienen incidentes. `limit` pasado a ambas agregaciones de bono = `len(scope_ids) or 1` (cubre TODO el equipo, no un top-10).
- **`indice_equipo` — RH/director sin filtro (`scope_ids is None`)**: NO se agrega la organización completa sin límite. Se aplica `TOPE_ALTO_EQUIPO = 500` como `limit` explícito a ambas agregaciones de bono (que ya truncan por `ORDER BY cnt DESC LIMIT`), y el ranking final universo se arma desde la unión de empleados con al menos un evento en alguna fuente (actas/incidencias/faltas) — truncado de nuevo a `TOPE_ALTO_EQUIPO` tras ordenar peor-primero. Es una vista de "top offenders" acotada, no un listado universal de toda la plantilla.
- **Ranking**: ordenado por índice ascendente (peor primero) — más accionable para RH/supervisores.
- **Scoping de `indice_empleado`**: `_ensure_puede_ver_empleado` — empleado inexistente → `NotFoundError` (404); existe pero fuera de `scope_ids` → `ForbiddenError` (403); RH/director (`scope_ids is None`) ve a cualquiera.
- **Validación de rango de fechas**: `fecha_inicio > fecha_fin` → `DomainValidationError` (422), en `indice_empleado`, `indice_equipo` e `indice_historial_empleado`.
- **Firmas-espejo fase 2**: mismo cálculo (`_calcular_resultado_empleado`, compartido con `indice_empleado`) pero sin resolver scope de usuario — pensadas para una llamada interna servicio-a-servicio desde Ciclo de Desempeño, no conectadas a ningún endpoint todavía. `_o_none` captura `LeoniException` y devuelve `None` en vez de propagar (empleado inexistente, rango inválido, bono con error, etc.).
- **Faltas GOCE (levelup, BD principal)**: NO se agregan en v1 (peso 0, documentado en T1); el service no las consulta, solo agrega faltas desde bono (`BonoFaltasRetardosRepository`).

## Tests + resultado

`tests/test_historial_objetivo_service.py` (nuevo, 16 tests) — mockea `BonoProductividadReadClient.create_read_engine` + ambos repos de bono en el namespace del service (mismo patrón que `tests/test_faltas_retardos.py`); **nunca toca la BD externa real**.

Cobertura: índice combinando las 3 fuentes calculado a mano (24 penalización → 76/amarillo); engine único + dispose (camino feliz y camino de error `SQLAlchemyError`→`ServiceUnavailableError`); bono no configurado → degradación (solo actas); progresivo nunca penaliza; tipo desconocido en incidencias y código desconocido en faltas → se ignoran y se loguean (`caplog`); scoping (403 fuera de alcance, 404 inexistente, RH ve a cualquiera); rango de fechas inválido → 422; `indice_equipo` con scope de supervisor (limit = tamaño de equipo, no 10) y ranking ordenado peor-primero; `indice_equipo` RH sin filtro aplica `TOPE_ALTO_EQUIPO` explícito; firmas-espejo (mismo índice que `indice_empleado`, y `_o_none` degrada a `None` si el empleado no existe).

```
docker-compose run --rm test pytest tests/test_historial_objetivo_service.py tests/test_historial_objetivo_formula.py tests/test_historial_objetivo_actas_repo.py tests/test_historial_objetivo_scope.py -q
41 passed, 1 warning in 10.63s
```

(Suite completa del proyecto supervisada aparte por el coordinador, no repetida aquí.)

## Concerns

- **N+1 en `indice_equipo` para empleados solo-en-actas**: si un `empleado_id` del scope no aparece en ninguna fila de bono (sin eventos en el rango), se hace una consulta puntual (`get_by_empleado_id`) para resolver `no_empleado`/`nombre` para el ranking. Aceptable para tamaños de equipo típicos (v1); si RH usa `indice_equipo` con equipos grandes y muchos empleados sin eventos de bono, podría acumular N consultas. No se optimizó con un bulk-fetch porque `EmpleadoRepository` no expone uno hoy (fuera del scope de esta tarea).
- **`MODULE_KEY = "historial-objetivo"`** no está registrado (a mi verificación) en el registro de módulos RH (`app.core.rh_module_registry`) — `user_has_module` simplemente devuelve `False` para una clave no registrada, así que el helper de T3 degrada correctamente a "no elevado" sin romper, pero si se quiere que el módulo otorgado eleve a scope "rh" (feature de permisos RH), falta ese registro; no era parte del alcance de esta tarea (T3 ya lo señaló como genérico por `module_key`).
- **`TOPE_ALTO_EQUIPO = 500`** es un valor elegido por mí (el brief no fija un número); documentado en el código. T5/QA pueden ajustarlo si el volumen real de "top offenders" para RH/director lo amerita.
- No se conectó nada a HTTP/routers ni a Ciclo de Desempeño — eso es explícitamente fuera de esta tarea (T5 y un futuro consumidor).

## Fixes post-revisión

Dos fixes "Important" señalados en la revisión de esta tarea, aplicados sobre `indice_equipo`:

### Fix 1 — N+1 al resolver nombres (`indice_equipo`)

Antes, cada `empleado_id` del universo sin fila en la agregación de bono (sin eventos en el rango) disparaba una consulta puntual `EmpleadoRepository.get_by_empleado_id(...)` dentro del loop de armado del ranking — N+1 real para equipos/universos grandes.

- Se agregó `EmpleadoRepository.get_nombres_por_empleado_ids(empleado_ids)` (`app/repositories/empleado_repository.py`) — una sola query `SELECT empleado_id, no_empleado, nombre FROM empleados WHERE empleado_id IN (...)`, devuelve `dict[int, tuple[str | None, str | None]]`. Mismo patrón que `MetasRepository.get_nombres_empleados` / `CicloDesempenoRepository.get_nombres_empleados`, extendido para incluir también `no_empleado`.
- `indice_equipo` ahora calcula `faltantes_ids` (empleados del universo que no aparecen en `bono.info_por_empleado`) una vez, y resuelve TODOS sus nombres con una sola llamada bulk antes del loop. El loop solo hace lookups en memoria (`dict.get`).
- Test nuevo: `test_indice_equipo_resuelve_nombres_faltantes_en_una_sola_query_bulk` — parchea `EmpleadoRepository.get_by_empleado_id` para que lance `AssertionError` si se llega a invocar (detector de regresión N+1), envuelve `get_nombres_por_empleado_ids` con `wraps` para verificar `assert_called_once()`, y confirma que el ranking sigue trayendo `no_empleado`/`nombre` correctos para los empleados sin eventos de bono.

### Fix 2 — Actas sin acotar para RH sin filtro (`indice_equipo`)

Cuando `scope_ids is None` (RH/director sin equipo delimitado), `ActaRepository.count_por_empleado_por_estado(None, fecha_inicio, fecha_fin)` corría sin filtro de empleado; si además no venía rango de fechas, tampoco quedaba acotada por fecha — la única fuente con tope real era bono (`TOPE_ALTO_EQUIPO` en el `limit`).

- Decisión (de las dos alternativas del brief): **exigir el rango en el service**, no aplicar un default silencioso ahí. Es más explícito y evita que el service adivine una ventana de negocio (últimos 12 meses) que le corresponde a la capa HTTP.
- `indice_equipo`: cuando `scope_ids is None` y (`fecha_inicio is None` o `fecha_fin is None`) → `DomainValidationError("Para el ranking global de RH debes especificar un rango de fechas")` (422). Con `scope_ids` delimitado (supervisor/gerente/empleado) NO se exige rango — el tope ya lo da el propio equipo.
- El default de últimos 12 meses para la UI/API queda para T5 (la API pasará el rango si el caller no especifica uno); el service ahora se protege sin importar quién lo invoque.
- Tests nuevos:
  - `test_indice_equipo_rh_sin_filtro_y_sin_rango_de_fechas_da_422` — sin fechas, solo `fecha_inicio`, solo `fecha_fin` → las 3 combinaciones lanzan `DomainValidationError`.
  - `test_indice_equipo_rh_sin_filtro_con_rango_de_fechas_funciona` — con rango completo, `indice_equipo` corre normalmente.
  - `test_indice_equipo_supervisor_sin_rango_de_fechas_sigue_funcionando` — confirma que el requisito de rango aplica solo al universo sin acotar, no a un equipo delimitado.
  - Se ajustó el test preexistente `test_indice_equipo_rh_sin_filtro_aplica_tope_alto_explicito` para pasar un rango de fechas (antes llamaba sin fechas, lo cual ahora es inválido).

### Resultado de tests

```
docker-compose run --rm test pytest tests/test_historial_objetivo_service.py -q
20 passed, 1 warning in 7.65s
```

Sin cambios en la fórmula, el engine único de bono, el scoping por equipo ni la degradación de bono — cambios acotados a `indice_equipo` y al nuevo método bulk en `EmpleadoRepository`.
