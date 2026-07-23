# Agregador de progresivo/bono para el Historial Objetivo — Diseño

**Fecha:** 2026-07-22
**Sub-proyecto de:** Suite de Talento (cierre del Historial Objetivo)
**Rama:** `feat/cm/historial-progresivo` → PR a `main`

## Contexto

El **Historial Objetivo** produce un índice 0–100 por empleado (100 = limpio)
cruzando cuatro fuentes: actas, faltas/retardos, incidencias (calidad+seguridad)
y **progresivo**. Hoy las tres primeras tienen agregador real; la cuarta
(`FUENTE_PROGRESIVO`) tiene peso documentado (`PESO_PROGRESIVO_DEFAULT = 6`) pero
`PESOS_POR_FUENTE[FUENTE_PROGRESIVO] = {}` y el service siempre pasa un
`ConteosFuente()` vacío — es el único gap del módulo.

### Hallazgo clave (define el diseño)

La fuente de datos "progresivo" en la BD de bono son las tablas
`incidencias_progresivo` e `incidencias_progresivo_historico`. **No son un tipo
de evento nuevo**: cada fila es un resumen semanal por empleado que ya contiene
contadores de `faltas_injustificadas`, `suspensiones`, `quejas_calidad`,
`actas_admin`, etc. — las mismas categorías que el índice ya cuenta desde las
fuentes de faltas, actas e incidencias. Agregar esos contadores como una cuarta
fuente produciría **doble conteo**.

El campo que NO se solapa y es la señal propia del progresivo es
**`pierde_bono`** (0/1): la semana en que el empleado perdió su bono de
productividad — un resultado, no las causas ya contadas.

### Estado verificado en código

- `app/services/historial_objetivo/constants.py`: `FUENTE_PROGRESIVO = "progresivo"`;
  `PESO_PROGRESIVO_DEFAULT = 6`; `PESOS_POR_FUENTE[FUENTE_PROGRESIVO] = {}` (vacío).
- `app/services/historial_objetivo/formula.py`:
  `indice = clamp(100 - Σ(peso_tipo · conteo_tipo), 0, 100)`.
- `app/services/historial_objetivo_service.py`:
  - `_agregar_bono(*, empleado_id, empleado_ids_scope, fecha_inicio, fecha_fin,
    limit)` abre **un** engine de bono (`BonoProductividadReadClient.create_read_engine()`,
    `dispose()` en `finally`), instancia `BonoHistoricoIncidenciasRepository` +
    `BonoFaltasRetardosRepository` sobre ese engine, y devuelve un `_BonoAgregado`
    con `disponible`, `faltas_por_empleado`, `incidencias_por_empleado`,
    `info_por_empleado`.
  - `_conteos_fuente_filtrados(fuente, conteos_raw: dict[str,int]) -> ConteosFuente`
    filtra las claves contra `PESOS_POR_FUENTE[fuente]` (loguea las desconocidas).
  - Tres call-sites pasan `progresivo=ConteosFuente()` (vacío):
    `_calcular_resultado_empleado` (~294), `indice_equipo` (~397),
    `indices_historial_por_empleado` (~457, fase 2).
- `app/repositories/bono_productividad_incidencias_repository.py` +
  `sql/bono_incidencias_consolidado.sql`: ya consolidan progresivo/progresivo_historico
  con `pierde_bono` y join a `semana_historico` (que tiene `fecha_ini`). Es solo
  para el listado consolidado del módulo `bono_productividad`, no agrega por empleado.
- Los repos de bono cargan su SQL de archivos en `app/repositories/sql/` y reciben
  un `AsyncEngine`; tests en `tests/test_bono_historico_incidencias_repository.py`.

## Decisiones aprobadas por el usuario

1. **Progresivo mide `pierde_bono=1`** — cuántas semanas el empleado perdió su
   bono de productividad. Señal limpia, sin doble conteo.
2. **Vigente + histórico**: contar sobre `incidencias_progresivo` E
   `incidencias_progresivo_historico`, unificadas y filtradas por la fecha de la
   semana (`semana_historico.fecha_ini`), para cubrir todo el periodo evaluado sin
   importar dónde quedó archivada la semana.
3. **Peso 6** (mantener `PESO_PROGRESIVO_DEFAULT`): cada semana sin bono resta 6,
   igual que una incidencia de calidad/seguridad.

## Arquitectura

Extensión del Historial Objetivo, **solo lectura** sobre la BD de bono. Sin tabla
nueva, sin migración. Un repo nuevo con una consulta agregada, enchufado al
**mismo engine** que ya abre `_agregar_bono`, y un cambio de una entrada en la
tabla de pesos. Los consumidores del índice (ficha, equipo, y el bulk de la fase
2 que alimenta el ciclo de desempeño) recogen la nueva penalización sin cambios
propios.

## Datos (BD de bono, solo lectura)

Nuevo repo `app/repositories/bono_progresivo_repository.py`
(`BonoProgresivoRepository(engine)`), con su SQL en
`app/repositories/sql/bono_progresivo_semanas_sin_bono.sql`:

```sql
-- Cuenta semanas con pierde_bono = 1 por empleado, sobre progresivo vigente +
-- historico, filtrando por la fecha de inicio de semana (semana_historico.fecha_ini).
WITH progresivo_union AS (
    SELECT ip.id_empleado AS empleado_id, ip.pierde_bono, s.fecha_ini
    FROM incidencias_progresivo ip
    JOIN semana_historico s ON s.id = ip.id_semana
    UNION ALL
    SELECT iph.id_empleado AS empleado_id, iph.pierde_bono, s.fecha_ini
    FROM incidencias_progresivo_historico iph
    JOIN semana_historico s ON s.id = iph.id_semana
)
SELECT empleado_id, COUNT(*) AS semanas
FROM progresivo_union
WHERE COALESCE(pierde_bono, 0) = 1
  AND fecha_ini IS NOT NULL
  AND EXTRACT(YEAR FROM fecha_ini) BETWEEN 1900 AND 2100
  AND (:f_fecha_inicio IS NULL OR fecha_ini >= :f_fecha_inicio)
  AND (:f_fecha_fin   IS NULL OR fecha_ini <= :f_fecha_fin)
  AND (:f_empleado_id IS NULL OR empleado_id = :f_empleado_id)
  AND (:f_scope_todos = TRUE OR empleado_id = ANY(:f_empleado_ids_scope))
GROUP BY empleado_id
```

Método:
```python
async def aggregate_semanas_sin_bono_por_empleado(
    self,
    *,
    empleado_id: int | None = None,
    empleado_ids_scope: list[int] | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
) -> dict[int, int]:
    """Semanas con pierde_bono=1 por empleado (vigente + historico), filtradas
    por fecha de semana. Devuelve {empleado_id: n_semanas}; empleados sin
    semanas perdidas no aparecen (se tratan como 0)."""
```

El manejo exacto de los bind params de scope (patrón `ANY(:ids)` vs. flag
"todos") se alinea con lo que ya usan los otros repos de bono
(`BonoHistoricoIncidenciasRepository` / `BonoFaltasRetardosRepository`) — se
sigue ese patrón, no se inventa uno nuevo.

> **Nota de portabilidad de tests:** los tests del módulo corren en SQLite
> in-memory. La query final debe ser válida en el motor donde se ejecute el test
> (o el test debe mockear el repo, siguiendo el patrón de
> `test_bono_historico_incidencias_repository.py` / los tests de service que
> mockean `create_read_engine`). El plan fija cuál de los dos enfoques aplica.

## Constantes / fórmula

En `app/services/historial_objetivo/constants.py`:
- Nueva constante `TIPO_PROGRESIVO_PIERDE_BONO = "pierde_bono"` (evita el string
  suelto en repo y service).
- `PESOS_POR_FUENTE[FUENTE_PROGRESIVO]` pasa de `{}` a
  `{TIPO_PROGRESIVO_PIERDE_BONO: PESO_PROGRESIVO_DEFAULT}` (peso 6, en un solo
  lugar). Actualizar el comentario que hoy dice "v1 sin agregador".

La fórmula no cambia: con `conteos = {"pierde_bono": N}` resta `6 · N`.

## Service (integración)

En `HistorialObjetivoService`:
- `_agregar_bono`: instanciar también `BonoProgresivoRepository(engine)` sobre el
  **mismo** engine ya abierto; ejecutar `aggregate_semanas_sin_bono_por_empleado`
  con el mismo `empleado_id`/`empleado_ids_scope`/rango. Añadir al `_BonoAgregado`
  un campo `progresivo_por_empleado: dict[int, ConteosFuente]` (o `dict[int,int]`
  de semanas, convertido con `_conteos_fuente_filtrados(FUENTE_PROGRESIVO,
  {"pierde_bono": n})`). La consulta extra corre dentro del mismo `try/finally`;
  un `SQLAlchemyError` degrada igual que hoy (→ `ServiceUnavailableError`, o bono
  no disponible → progresivo vacío).
- Los tres call-sites que hoy pasan `progresivo=ConteosFuente()` pasan el conteo
  real desde `bono.progresivo_por_empleado.get(eid, ConteosFuente())`.
- Degradación: bono no disponible (`disponible=False`) → progresivo 0 para todos,
  como el resto de fuentes de bono.

Coste: una query agregada más por operación, sobre el mismo engine (mismo
`dispose`). El scope acotado (equipo/empleado) la mantiene barata; el bulk de la
fase 2 hereda el conteo sin abrir engines extra.

## Frontend

El desglose por fuente en la ficha del Historial Objetivo ya renderiza la fila
`progresivo` (hoy siempre 0). Pasará a mostrar el conteo real. Cambio mínimo:
confirmar/ajustar la etiqueta de la fila a algo legible ("Semanas sin bono") y
que el conteo/penalización se muestren igual que las otras fuentes. Sin nuevas
llamadas ni tipos (el shape de la respuesta no cambia: la fuente progresivo ya
viene en el desglose, solo deja de ser 0). Verificar en la implementación si el
label ya es adecuado.

## Testing

- **Repo** (`BonoProgresivoRepository`): conteo por empleado de semanas con
  `pierde_bono=1`; unión vigente+histórico; filtro por rango de `fecha_ini`;
  descarte de fechas basura (año fuera de 1900–2100); filtro por `empleado_id` y
  por `empleado_ids_scope`; empleado sin semanas perdidas ausente del dict.
- **Constantes/fórmula**: `PESOS_POR_FUENTE[FUENTE_PROGRESIVO]` no vacío; un caso
  de `calcular_indice` con progresivo penalizando (`{"pierde_bono": 2}` → −12).
- **Service**: `_agregar_bono` instancia el 3er repo sobre el **mismo** engine (un
  solo `create_read_engine` + un solo `dispose`, verificado con mock); el índice de
  un empleado con N semanas sin bono resta `6·N`; degradación (bono no disponible)
  → progresivo 0 sin crash; el bulk de la fase 2 recoge la penalización.
- **Regresión**: empleados sin semanas perdidas mantienen su índice actual; suite
  completa sin fallos.
- Frontend: `npm run build` limpio + `npm run test` verde.

## Riesgos / trade-offs

- **Doble conteo (resuelto):** solo se cuenta `pierde_bono`, no los contadores del
  resumen que ya cubren otras fuentes.
- **Engine único:** el nuevo repo va sobre el engine ya abierto por `_agregar_bono`;
  no se abre un engine extra ni uno por empleado.
- **Fecha por semana:** progresivo no tiene fecha de evento; se usa
  `semana_historico.fecha_ini` (con descarte de años basura, patrón ya usado en el
  consolidado).
- **Portabilidad SQLite/Postgres del test:** el plan decide entre test de repo con
  motor real vs. mock del service (patrón existente); la query no debe usar
  construcciones que rompan el motor de test elegido.
- **Peso configurable:** el 6 vive en `PESO_PROGRESIVO_DEFAULT`, un solo lugar.

## Decomposición en tareas (para el plan)

1. Constantes: `TIPO_PROGRESIVO_PIERDE_BONO` + `PESOS_POR_FUENTE[FUENTE_PROGRESIVO]`
   no vacío. Test puro de fórmula con progresivo.
2. Repo `BonoProgresivoRepository` + SQL. Tests del repo.
3. Integración en `_agregar_bono` + los 3 call-sites del service. Tests de service
   (engine único, penalización, degradación).
4. Frontend: etiqueta/render de la fila progresivo en el desglose. Build.
5. Cierre de huecos de cobertura.
