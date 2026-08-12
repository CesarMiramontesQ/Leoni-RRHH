# Ocultar incidencias de empleados que no existen en Bono

Fecha: 2026-08-12

## Problema

El listado de Faltas y retardos, sus estadísticas y el dashboard de RH muestran
incidencias de empleados que no existen en la tabla `empleados` de Bono. Salen con el
nombre vacío y con `empleado_id = 0`, y contaminan los totales, la gráfica por tipo, la
tendencia y el top de empleados con más eventos.

El origen es la caché `levelup_incidencias_tress`: el sync la llena desde `dbo.AUSENCIA`
y `dbo.PERMISO` de TRESS, donde hay `CB_CODIGO` que nunca se dieron de alta en Bono. Para
esas filas el sync deja `empleado_id = NULL` —el modelo ya lo documenta— y
`map_cache_row` las expone con `empleado_id = 0` **a propósito**, «para que el total de la
página cuadre con lo que se ve». Esa decisión se revierte aquí: RH no quiere verlas.

La página **Incidencias** de calidad/seguridad no está afectada: su SQL base
(`incidencias_historico_unificado_base.sql`) ya hace `JOIN empleados`, así que un empleado
ausente de Bono nunca aparece ahí.

## Criterio

Se oculta la incidencia cuando su `no_empleado` de TRESS **no empata con ninguna fila de
`empleados`**, es decir cuando `levelup_incidencias_tress.empleado_id IS NULL`.

Las bajas y los inactivos **sí se siguen viendo**: existen en Bono, trabajaron aquí y su
historial de incidencias es información legítima.

## Solución

Un único predicado en el helper compartido `_filtros` de
`app/repositories/incidencias_tress_cache_repository.py`:

```python
conds.append(IncidenciaTress.empleado_id.is_not(None))
```

`_filtros` lo consumen las seis lecturas de la caché —`count`, `list_offset`,
`aggregate_por_tipo`, `aggregate_por_mes`, `aggregate_por_periodo_y_tipo` y
`aggregate_empleados_top`—, así que un solo cambio cubre las tres superficies y, sobre
todo, las mantiene **coherentes entre sí**: filtrar solo el listado dejaría el `total` de
la paginación por encima de las filas visibles y descuadraría los agregados contra la
tabla.

El predicado va sin condición: no es un filtro opcional del usuario, es la regla de la
caché.

### Por qué `empleado_id IS NULL` y no un `EXISTS` contra `empleados`

- La columna existe exactamente para esto y el sync la reestampa en cada corrida
  (`_aplicar_fila_tress` la recalcula tanto al insertar como al actualizar).
- Un `EXISTS` tendría que empatar por `no_empleado`, que en Bono es Integer y en el
  repositorio se parsea con cuidado (`_no_empleado_int`). Más frágil, sin ganancia real.
- Es un predicado sobre una columna indexable, no una subconsulta correlacionada por cada
  agregado.

### Consecuencia aceptada

Si un empleado se da de alta en Bono después, sus incidencias reaparecen hasta que el sync
vuelva a estampar `empleado_id`: la corrida semanal del miércoles 10:00 para el rango vivo,
o `python -m app.scripts.sync_incidencias_tress --desde … --hasta … --execute` para un
tramo histórico ya fuera de ventana.

## Fuera de alcance

- **El sync no cambia.** Sigue guardando esas filas. Conservarlas es lo que permite que
  reaparezcan solas cuando el empleado se da de alta, en vez de exigir un resync del rango.
- **No hay cambio de contrato de API**: mismas rutas, mismos schemas. `openapi.yaml` no se
  toca.
- **El frontend no cambia.** Solo se actualiza el docstring de `map_cache_row`
  (`app/services/faltas_retardos/mapper_cache.py`), que hoy documenta lo contrario de lo
  que va a ocurrir. La normalización `empleado_id or 0` se queda como defensa.

## Pruebas

Sobre `IncidenciasTressCacheRepository`, con filas sembradas con y sin `empleado_id`:

1. `count` no cuenta las de `empleado_id NULL`.
2. `list_offset` no las devuelve.
3. `aggregate_por_tipo`, `aggregate_por_mes` y `aggregate_por_periodo_y_tipo` las excluyen
   de sus totales.
4. `aggregate_empleados_top` no lista al empleado fantasma.

Y de extremo a extremo en `tests/test_faltas_retardos.py`: `GET /api/v1/faltas-retardos`
devuelve un `total` que ya no incluye esas filas, y `GET /estadisticas` no las suma.
