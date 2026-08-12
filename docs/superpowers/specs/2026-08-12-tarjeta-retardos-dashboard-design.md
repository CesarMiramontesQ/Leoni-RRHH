# Tarjeta de retardos en el dashboard personal

Fecha: 2026-08-12

## Problema

Las tarjetas del dashboard personal (`renderEmpleadoStatCards`) muestran «Utilizados» —
días de vacaciones ya gozados del ciclo vigente. No aporta: el empleado ya ve
«Disponibles» al lado, que es el número con el que decide, y el histórico completo está
en la Vista 360. La tarjeta ocupa un cuarto del espacio de la fila para un dato que nadie
acciona.

En su lugar va el conteo de **retardos del año en curso**, que sí es accionable y hoy solo
es visible para RH en la página Incidencias.

## Alcance

El componente lo comparten dos pantallas: el dashboard de rol `empleado` y el bloque
«personal» del dashboard de líder (`liderTeamDashboard.ts` arma un
`EmpleadoDashboardPayload` y llama al mismo render). El cambio aplica a las dos, sin
parametrizar el componente.

## Fuente del dato

`levelup_incidencias_tress`, caché en Bono que escribe `sync_incidencias_tress_service`.
**Ninguna consulta nueva a DATOS_ANALISIS**: el dashboard no puede esperar a esa BD, y esa
regla ya la cumplen las otras tres tarjetas.

El conteo reusa `IncidenciasTressCacheRepository.count()`:

```python
count(fecha_inicio=date(anio, 1, 1), fecha_fin=hoy,
      cb_codigos=[no_empleado], tipo="retardo")
```

Reusar ese método —en vez de escribir un `select` propio— no es comodidad: el predicado
`empleado_id IS NOT NULL` y la semántica de rango de fechas viven en el helper `_filtros`,
que comparten las seis lecturas de la caché. Un query paralelo se descuadraría contra la
página Incidencias en cuanto alguien tocara ese helper, y el empleado vería un número
distinto al que RH tiene enfrente.

### Retraso conocido y aceptado

El sync corre los **miércoles a las 10:00**. Un retardo del jueves no aparece en la
tarjeta hasta la semana siguiente. Es la misma latencia que ya tiene la página Incidencias
de RH, así que las dos superficies coinciden; se acepta a cambio de no consultar TRESS en
cada carga de página.

## Degradación

Igual que home office, y por la misma razón (un dashboard no puede romperse por un dato de
nómina):

- Sin filas ⇒ `0`. Es un dato real: el empleado no tuvo retardos. No es una ausencia.
- Falla la lectura de Bono ⇒ `None` ⇒ la UI pinta «—», nunca «0».

### El conteo no depende de la fila de vacaciones

Hoy `obtener_kpis_dashboard` hace `return _sin_datos(...)` cuando el empleado no tiene fila
en `levelup_vacaciones_disponibles`, y con eso **todo** el payload sale en `None`. Un
ingreso reciente sin sincronizar dejaría de ver sus retardos aunque el dato exista.

El conteo se calcula **antes** de ese early-return y se incluye también en el payload
degradado. `retardos_anio` queda independiente de `disponible`, que sigue describiendo
solo el bloque de vacaciones; el schema lo documenta.

## Cambios

**Backend**

- `app/schemas/dashboard_kpis.py`: campo `retardos_anio: int | None`.
- `app/services/dashboard_kpis_service.py`: `_retardos_anio()`, gemelo de
  `_home_office_dias_anio()`, y su uso en las dos ramas de retorno.
- `openapi.yaml`: el campo en `DashboardKpisResponse`.

`vacaciones_tomadas_ciclo` **se conserva** en el contrato. Sale de la misma fila que ya se
lee, no cuesta una consulta extra, y retirarlo del API es un cambio que nadie pidió. Queda
sin consumidor.

**Frontend**

- `api/dashboardKpis.ts`: `retardos_anio` en el tipo.
- `dashboard/empleado/types.ts`, `dashboard/lider/types.ts`: `vacation_used_days` →
  `retardos_anio`.
- `dashboard/empleado/fetchEmpleadoDashboard.ts`, `dashboard/lider/fetchLiderDashboard.ts`,
  `components/dashboard/liderTeamDashboard.ts` y los dos `mock.ts`: mismo reemplazo.
- `components/dashboard/empleadoPersonalDashboard.ts`: la tarjeta.

| | Antes | Después |
|---|---|---|
| label | Utilizados | Retardos |
| valor | `fmtDays(vacation_used_days)` | conteo entero |
| sub | Vacaciones tomadas | Acumulados este año |
| icono | maleta | reloj |

Conserva `desdeTress: true`, así hereda el esqueleto de carga que ya existe para los KPIs
que llegan en su propia petición.

## Tests

Backend (`tests/test_dashboard_kpis.py`):

- un retardo del año en curso cuenta; uno del año anterior, no;
- una falta injustificada no cuenta;
- sin retardos ⇒ `0`;
- si la lectura falla ⇒ `None`, y el resto del payload sigue llegando;
- el conteo aparece aunque el empleado no tenga fila de vacaciones.

`test_ningun_kpi_consulta_datos_analisis` cubre ya que ninguna de estas rutas toque TRESS;
debe seguir pasando sin tocarlo.

Frontend: ajustar `dashboard/dashboardKpisTress.test.ts` al campo nuevo.
