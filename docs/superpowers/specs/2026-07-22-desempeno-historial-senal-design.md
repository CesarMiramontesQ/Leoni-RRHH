# Fase 2 — Historial Objetivo como señal del Ciclo de Desempeño

**Fecha:** 2026-07-22
**Sub-proyecto de:** Suite de Talento (cierre del módulo Desempeño)
**Rama:** `feat/cm/desempeno-historial-senal` → PR a `main`

## Contexto

El **Ciclo de Desempeño** calcula, por empleado y ciclo, un score de desempeño
(0–100) y una banda (`bajo`/`medio`/`alto`) combinando **dos** señales
ponderadas: cumplimiento de metas y evaluación 360. El **Historial Objetivo**
(módulo ya en producción) produce un índice objetivo 0–100 por empleado
(100 = historial limpio, mayor = mejor) cruzando actas, faltas/retardos e
incidencias. Cuando se construyó, se dejaron listas las **firmas-espejo**
`HistorialObjetivoService.indice_historial_empleado(...)` /
`indice_historial_empleado_o_none(...)` documentadas como "consumo futuro desde
Ciclo de Desempeño", aún sin consumidor.

Esta fase 2 conecta ambos: el índice objetivo entra como **tercera señal
ponderada** del score del ciclo, con su propio peso configurable
(`peso_historial`), **default 0** para no alterar ningún ciclo existente.

### Estado actual verificado en código

- `app/services/ciclo_desempeno_service.py`:
  - Función pura `combinar_score(cumplimiento_metas, calificacion_360_norm,
    peso_metas, peso_competencias) -> tuple[Optional[float], Optional[float],
    Optional[float]]` — devuelve `(score, peso_metas_efectivo,
    peso_competencias_efectivo)`. `None` en una señal = AUSENTE (distinto de
    `0.0` real); si una señal falta, la presente absorbe el 100% del peso
    efectivo; ninguna presente → `(None, None, None)`.
  - `banda(valor, umbral_medio, umbral_alto) -> str`.
  - `_calcular_resultado_vivo(ciclo, empleado_id, participante_by_empleado,
    escala) -> dict` es el ÚNICO call-site de `combinar_score`. Devuelve un dict
    con `cumplimiento_metas`, `calificacion_360_*`, `calificacion_desempeno`
    (score), `peso_metas_efectivo`, `peso_competencias_efectivo`,
    `banda_desempeno`.
  - `_contexto_senales(ciclo)` prepara UNA vez el contexto de la señal 360
    (campaña, mapa participante, escala) antes de iterar empleados.
  - `cerrar_ciclo` congela cada resultado vía `repo.upsert_resultado(...,
    snapshot_at=ahora)`; `resultados_ciclo` calcula en vivo (activo) o lee el
    snapshot (cerrado); `construir_9box` agrupa por `banda_desempeno_efectiva`.
  - Ya integrada la **calibración** (fase previa): `banda_desempeno_efectiva =
    banda_efectiva(banda_desempeno, banda_desempeno_ajustada)`.
- `app/models/ciclo_desempeno.py`:
  - `CicloDesempeno`: `peso_metas` Numeric(5,2) default 60, `peso_competencias`
    Numeric(5,2) default 40, `umbral_medio` 50, `umbral_alto` 75,
    `fecha_inicio`/`fecha_fin` Date nullable, `config` JSONB.
  - `CicloDesempenoResultado`: `cumplimiento_metas`, `calificacion_360_raw/norm`,
    `calificacion_desempeno`, `peso_metas_efectivo`, `peso_competencias_efectivo`
    (todos Numeric nullable), `banda_desempeno`, `snapshot_at`, y las columnas de
    calibración (`banda_desempeno_ajustada`, etc.).
- `app/schemas/ciclo_desempeno.py`:
  - `CicloDesempenoCreate`: `peso_metas` (default 60, ge=0), `peso_competencias`
    (default 40, ge=0), validador `(peso_metas + peso_competencias) > 0`,
    validador de umbrales. `CicloDesempenoUpdate` con los mismos opcionales.
  - `CicloDesempenoResultadoResponse` (`from_attributes=True`).
- `app/services/historial_objetivo_service.py`: `HistorialObjetivoService` con
  `indice_equipo(...)` (calcula índices de un conjunto de empleados con **un
  solo engine** de bono + `dispose()` en `finally`), e `indice_historial_empleado`
  / `_o_none(empleado_id, fecha_inicio, fecha_fin)` (por-empleado, abren engine
  internamente — NO usarlas en loop). Índice: 0–100, 100 = limpio.
- Migración head vigente: `c1a2l3i4b5r6` (calibración). La nueva revisión
  encadena a ese (verificar `alembic heads` al implementar).

## Decisiones aprobadas por el usuario

1. **Tercera señal ponderada.** El índice objetivo se combina con metas y 360 en
   el score, con peso propio `peso_historial`. Misma dirección (100 = mejor), así
   que suma directo. Señal ausente (empleado sin historial) → su peso se
   redistribuye entre las presentes, igual que las otras señales.
2. **`peso_historial` default 0 (opt-in).** Un ciclo nuevo no cuenta el historial
   salvo que el admin RH suba el peso. Cero regresión: con `peso_historial=0` el
   score es idéntico bit a bit al actual.
3. **Periodo = fechas del ciclo.** El índice se calcula sobre
   `fecha_inicio`–`fecha_fin` del ciclo; si el ciclo no tiene fechas, cae a los
   últimos 365 días.

## Arquitectura

Extensión del módulo Ciclo de Desempeño (mismo service, mismo router, misma
página). No es un módulo nuevo. Una migración `levelup_` (add columns), cálculo
puro extendido a 3 señales, una llamada bulk servicio-a-servicio al
`HistorialObjetivoService` (un engine, pre-cargada una vez por operación y solo
cuando `peso_historial > 0`), y ajustes de schema/frontend.

**Principio de no-regresión:** todo el diseño garantiza que con `peso_historial=0`
(default y estado de todos los ciclos existentes) el comportamiento es idéntico
al actual — incluyendo NO abrir el engine de bono.

## Modelo de datos (migración Alembic sobre tablas `levelup_`)

- `levelup_ciclo_desempeno`: `peso_historial` Numeric(5,2) NOT NULL default `0`.
- `levelup_ciclo_desempeno_resultado`:
  - `indice_historial` Numeric(6,2) nullable (índice objetivo usado en el score;
    `NULL` = señal ausente / bono no disponible).
  - `peso_historial_efectivo` Numeric(5,2) nullable (peso efectivo tras
    redistribución, análogo a `peso_metas_efectivo`).

Migración: `add_column` sobre las dos tablas `levelup_*`. Encadenar al head
vigente (`c1a2l3i4b5r6`; verificar con `alembic heads`).

## Cálculo (funciones puras en `ciclo_desempeno_service.py`)

Extender la combinación a 3 señales, preservando la semántica de redistribución
por señal ausente. Firma nueva:

```python
def combinar_score(
    cumplimiento_metas: Optional[Numero],
    calificacion_360_norm: Optional[Numero],
    indice_historial: Optional[Numero],
    peso_metas: Numero,
    peso_competencias: Numero,
    peso_historial: Numero,
) -> tuple[Optional[float], Optional[float], Optional[float], Optional[float]]:
    """Devuelve (score, peso_metas_efectivo, peso_competencias_efectivo,
    peso_historial_efectivo). Cada señal None = AUSENTE. El score es el promedio
    ponderado de las señales PRESENTES con peso > 0; el peso efectivo de una
    señal ausente (o con peso configurado 0) es 0, y el peso se normaliza sobre
    las presentes con peso > 0. Ninguna señal presente con peso > 0 -> todos None."""
```

Semántica precisa (generaliza la actual de 2 señales, preservando su
comportamiento observable):
- Una señal "cuenta" si su valor no es `None` **y** su peso configurado es `> 0`.
- **Score** (lo que garantiza la no-regresión): `score = Σ(peso_i · valor_i) /
  Σ(peso_i)` sobre las señales que cuentan (pesos configurados). Si ninguna
  cuenta → `None`. Esto coincide bit a bit con el actual en los casos de 2
  señales (ambas → `(pm·m+pc·g)/(pm+pc)`; una sola → esa señal).
- **Pesos efectivos** (reporte que se persiste, análogo a hoy): si TODAS las
  señales con peso configurado `> 0` cuentan, el efectivo de cada una es su peso
  configurado tal cual. Si falta alguna (valor `None`), los pesos de las
  presentes se re-escalan proporcionalmente para sumar `100` (esto reproduce el
  actual: solo-metas → `(100, 0)`; solo-360 → `(0, 100)`). Una señal que no
  cuenta tiene efectivo `0`. Ninguna cuenta → todos `None`.
- **Compatibilidad:** con `peso_historial=0`, `indice_historial` nunca cuenta;
  las "señales con peso > 0" son solo metas y 360, así que `score`, `pm_ef` y
  `pc_ef` son idénticos a la versión de 2 señales y `ph_ef = 0`. Cero regresión.

> Nota de implementación: los tests existentes de `combinar_score` (2 señales) se
> actualizan a la firma nueva pasando `indice_historial=None, peso_historial=0` y
> esperando el 4º valor de retorno. La aritmética de los casos de 2 señales no
> cambia.

`_calcular_resultado_vivo` recibe además el índice del empleado (pre-cargado, ver
abajo) y `ciclo.peso_historial`, llama a la nueva `combinar_score`, y agrega al
dict `indice_historial` y `peso_historial_efectivo`.

## Datos / rendimiento

El índice del historial vive en la BD externa de bono (engine por request). Para
no abrir un engine por empleado dentro del loop:

- Nuevo método bulk en `HistorialObjetivoService`:
  ```python
  async def indices_historial_por_empleado(
      self, empleado_ids: list[int], fecha_inicio: date | None, fecha_fin: date | None
  ) -> dict[int, float | None]:
      """Índice objetivo por empleado para el conjunto dado, con UN solo engine
      de bono (dispose en finally). Empleado sin datos / bono no disponible ->
      None (no crash). Reusa la agregación interna de indice_equipo sin resolver
      scope de current_user (llamada servicio-a-servicio)."""
  ```
- En el service del ciclo, un paso de contexto (junto a `_contexto_senales`)
  pre-carga `indices_por_empleado: dict[int, float | None]` para el scope del
  ciclo **una sola vez**, y **solo si `ciclo.peso_historial > 0`**. Si es 0, el
  dict queda vacío/None y el engine no se abre (no-regresión de costo).
- Rango: `ciclo.fecha_inicio`/`ciclo.fecha_fin`; si alguna es `None`, usar los
  últimos 365 días (misma convención que el router del historial objetivo).
- Degradación: si el engine de bono no está disponible, el bulk devuelve todos
  `None` (o el service captura y trata como señal ausente) — el ciclo sigue
  calculando con metas+360 sin crash.

## Integración con lo existente

- `resultados_ciclo` (rama viva): construye el response con los campos nuevos
  (`indice_historial`, `peso_historial_efectivo`) desde el dict calculado.
- `resultados_ciclo` (rama cerrada, `model_validate`): los campos nuevos vienen
  del snapshot persistido.
- `cerrar_ciclo`: congela `indice_historial` y `peso_historial_efectivo` en el
  snapshot vía `upsert_resultado`.
- **Calibración intacta:** `banda_desempeno` (calculada, ahora con historial) y la
  banda efectiva del override no cambian su relación. El override sigue ganando.
- **Validación de pesos:** `peso_metas + peso_competencias + peso_historial > 0`
  en `CicloDesempenoCreate`/`Update` (extiende la regla actual de 2 pesos).
  `peso_historial` con `ge=0`, default 0.

## API

- `CicloDesempenoCreate`/`CicloDesempenoUpdate`/`CicloDesempenoResponse`: campo
  `peso_historial` (default 0, ge=0).
- `CicloDesempenoResultadoResponse`: `indice_historial`, `peso_historial_efectivo`.
- Sin endpoints nuevos. Actualizar `openapi.yaml` (campos nuevos en los 3 schemas
  de ciclo + los 2 del resultado).

## Frontend (design system — solo tokens de `uiTokens.ts`)

- `frontend/src/pages/cicloDesempeno.ts`, form de alta/edición de ciclo (pestaña
  Ciclos de RH): input `peso_historial` junto a `peso_metas`/`peso_competencias`,
  con ayuda "0 = el historial no cuenta en el score". Enviar en create/update.
- Tabla de resultados: columna "Índice objetivo" (`indice_historial`) y, si aplica,
  el peso efectivo, en `tabular-nums`. Estado cuando es `null` ("—" / "sin dato").
- `frontend/src/api/cicloDesempeno.ts`: agregar `peso_historial` a los tipos de
  create/update/response y los 2 campos al tipo de resultado.
- No cambia nav ni policy (dentro del módulo existente).

## Testing

- **Puro** (`tests/test_ciclo_desempeno_*`): `combinar_score` con 3 señales
  presentes (promedio ponderado correcto); historial ausente (`None`) redistribuye
  a metas+360; `peso_historial=0` → score y `(pm_ef,pc_ef)` idénticos al caso de 2
  señales, `ph_ef=0`; solo historial presente; ninguna señal cuenta → todos `None`.
- **Service:** `indices_historial_por_empleado` usa UN engine y hace `dispose()`
  (mock de `create_read_engine`); con `peso_historial=0` el engine NO se abre
  (verificado con el mock sin llamadas); cierre congela `indice_historial` y
  `peso_historial_efectivo`; degradación (engine None) → índice None sin crash y
  el score cae a metas+360.
- **Validación:** `peso_historial` negativo → 422; los 3 pesos en 0 → 422; un
  ciclo con solo `peso_historial>0` y las otras en 0 es válido.
- **Regresión:** ciclos con `peso_historial=0` (todos los existentes) producen el
  mismo score/banda que antes; suite completa sin fallos.
- Frontend: `npm run build` limpio + `npm run test` verde.

## Riesgos / trade-offs

- **Costo del engine de bono:** mitigado — se abre una sola vez por operación y
  solo si `peso_historial > 0`; scope acotado al conjunto de empleados del ciclo.
- **Firma de `combinar_score` cambia:** un solo call-site real + tests; se
  actualizan en la misma tarea. Riesgo bajo, contenido.
- **Doble redondeo / precisión:** el índice ya viene redondeado a 2 decimales; el
  promedio ponderado redondea el score final como hoy.
- **Snapshot histórico:** ciclos ya cerrados NO se recalculan (su snapshot no
  tiene `indice_historial`; las columnas nuevas quedan `NULL`, y el response las
  expone como `null`). Correcto: la fase 2 aplica a ciclos que se cierren de aquí
  en adelante con `peso_historial>0`.
- **Periodo sin fechas:** fallback a últimos 365 días documentado.

## Decomposición en tareas (para el plan)

1. Migración Alembic + 3 columnas en los modelos.
2. `combinar_score` a 3 señales (pura) + tests puros; actualizar el call-site
   `_calcular_resultado_vivo` (mínimo para compilar/tests).
3. `HistorialObjetivoService.indices_historial_por_empleado` (bulk, un engine) +
   tests de service (un engine + dispose, degradación).
4. Integración en el service del ciclo: pre-carga condicional del índice,
   `_calcular_resultado_vivo` con la 3ª señal, `cerrar_ciclo` congela, response
   schema con los campos nuevos; validación de pesos. Tests de service.
5. Frontend: campo `peso_historial` en el form + columna índice en resultados +
   tipos del api client.
6. Cierre de huecos de cobertura.
