# Descansos y fecha de ingreso desde Bono: cerrar las últimas lecturas en vivo a DATOS_ANALISIS

**Fecha:** 2026-08-11
**Estado:** aprobado, pendiente de plan de implementación

## Problema

El objetivo declarado es que los dashboards de incidencias, vacaciones y home office no
esperen a `DATOS_ANALISIS` (SQL Server de TRESS) al renderizar. Una auditoría de todos los
puntos donde el backend abre un motor contra esa BD muestra que **ese objetivo ya está
cumplido para los dashboards**:

| Dato | Fuente hoy |
| --- | --- |
| KPIs de vacaciones disponibles / tomadas del ciclo | `levelup_vacaciones_disponibles` |
| KPI de home office del año | `levelup_homeoffice_tomados` |
| Página Incidencias y `/faltas-retardos/estadisticas` | `levelup_incidencias_tress` |
| Incidencias de calidad / seguridad | `calidad_historico` / `seguridad_historico` |
| `/empleados/{id}/saldo-vacaciones-real` | `levelup_vacaciones_disponibles` |

Quedan **exactamente dos lecturas en vivo a `DATOS_ANALISIS` en rutas que dispara un
usuario**. Ninguna de las dos es un dashboard, pero ambas cuestan una conexión ODBC nueva
por request y son lo único que impide afirmar que ninguna interacción del usuario espera a
nómina:

1. **Vista 360 → fecha de ingreso.** `usuario_service._obtener_fecha_ingreso_datos_analisis`
   (`app/services/usuario_service.py:64`, llamado en `:620`) consulta `dbo.COLABORA.CB_FEC_ING`
   en cada apertura del detalle de un empleado. Degrada a `None` ante cualquier fallo, pero
   igual paga la latencia en el camino feliz. La tabla `empleados` de Bono no tiene esa
   columna, así que no hay de dónde leerla sin cachearla.
2. **`GET /empleados/{id}/descansos`.** `descansos_empleado_service.obtener_descansos_tress`
   (`app/services/descansos_empleado_service.py:39`) hace hasta cuatro consultas a TRESS
   (Kardex, `dbo.TURNO`, `dbo.HORARIO`, `dbo.AUSENCIA`). Lo consumen el `workdayDatePicker`,
   el modal de nueva solicitud y el de nueva falta/retardo, más tres validaciones de
   `solicitud_service` y tres de `faltas_retardos_service`.

Todo lo demás que toca `DATOS_ANALISIS` son los syncs programados y los INSERT a nómina, y
debe quedarse ahí.

## Hallazgos del repositorio (base del diseño)

Nada de lo que sigue es supuesto; sale de leer el código actual.

### Sobre descansos

- **Las tres cuartas partes del cálculo ya están en Bono.** `levelup_turnos` es una réplica
  1:1 del catálogo `dbo.TURNO`, con `tu_rit_pat`, `tu_rit_ini`, `tu_tip_1..7` y
  `tu_hor_1..7`. `levelup_horarios` tiene `ho_intime` / `ho_outtime` / `ho_jornada` de
  `dbo.HORARIO`. `levelup_turnos_empleados.tu_codigo` tiene el turno vigente de cada
  persona. Los llenan `sync_turnos_catalogo` (03:40) y `sync_turnos_empleados` (04:20).
- **El motor de rotación ya está replicado y validado.** `app/utils/turno_calendario.py`
  reproduce `dbo.FN_GeneraRitmo` y fue validado día a día contra `dbo.AUSENCIA.HO_CODIGO`.
  `app/utils/turno_ciclo.turno_tress_desde_modelo` ya convierte un `levelup_turnos.Turno`
  en el `TurnoTress` que consume ese motor. `proyectar_calendario` + `fechas_descanso` dan
  la lista de fechas de descanso sin tocar ninguna BD.
- **Falta lo que no está cacheado:** el **Kardex** (`SP_KARDEX_CB_TURNO`, el turno *efectivo
  por fecha*) y el **override de `dbo.AUSENCIA`** (`AU_STATUS`, lo que nómina realmente
  aplicó). En Bono solo hay una foto del turno **vigente**.
- **`aplicar_override_ausencia` es el único consumidor de `AU_STATUS`** y no tiene otro
  llamador que `proyectar_calendario`.
- **`parse_hora_tress` vive en `datos_analisis_descansos_repository`** pero no es código de
  ese repositorio: lo importan `comedor_ventana_comida_service` y la docstring de
  `app/models/horarios.py`.
- **`proyectar_dia` levanta `ValueError`** para un turno rotativo sin `TU_RIT_INI` o cuando
  la fecha consultada es anterior al ancla. `turno_ciclo.ancla_valida` detecta además el
  «vacío» de TRESS (`1899-12-30`), que devolvería una posición de ciclo creíble y
  equivocada.
- **Los descansos son *fail-closed* por diseño.** `frontend/src/solicitudes/rh/descansosEmpleado.ts:11`
  lo declara explícitamente, porque de esa lista sale el conteo de días de una solicitud de
  vacaciones. Hoy un fallo de TRESS produce 503 y bloquea el modal.
- **Siete llamadores**, todos dentro de servicios que ya tienen una `AsyncSession` a mano
  (`self.db`): `DescansosEmpleadoService.obtener_descansos`, `solicitud_service` (`:444`,
  `:471`, `:627`) y `faltas_retardos_service` (`:509`, `:533`, `:629`).

### Sobre la fecha de ingreso

- `app/models/empleados.py` no tiene ninguna columna de fecha de ingreso, y `empleados` es
  una tabla legada de Bono: no se le puede agregar.
- `sync_turnos_empleados` ya lee `dbo.COLABORA`, pero filtra `CB_ACTIVO = 'S'` y su tabla
  destino está modelada alrededor del turno.
- El único consumidor de `DatosAnalisisColaboradorRepository` es la Vista 360.

## Decisiones tomadas

Tres decisiones se cerraron con el usuario antes de escribir este spec:

1. **Los descansos se proyectan con el turno vigente**, sin cachear Kardex ni `AUSENCIA`.
   Se acepta el riesgo residual: para fechas **anteriores a un cambio de turno**, la
   proyección usará el turno actual y podrá diferir de lo que TRESS aplicó. Se acepta
   porque el uso real es abrumadoramente hacia el futuro (pedir vacaciones, otorgar goce) y
   porque el motor de rotación ya fue validado contra lo que TRESS mismo computó.
2. **La fecha de ingreso vive en una tabla propia**, `levelup_empleados_tress`, no como una
   columna añadida a `levelup_turnos_empleados`.
3. **Se mantiene el fail-closed.** Si la caché no alcanza para proyectar con confianza, el
   endpoint responde 503 con un mensaje que dice qué falta, en lugar de devolver una lista
   vacía que haría contar días de más en una solicitud de vacaciones.

## Diseño

### 1. Tabla `levelup_empleados_tress`

Datos generales del colaborador en TRESS. Hoy solo la fecha de ingreso.

| columna | tipo | notas |
| --- | --- | --- |
| `no_empleado` | Integer PK | `CB_CODIGO`; corresponde a `empleados.no_empleado`, que es Integer. Sin FK declarativa, por el patrón de Bono |
| `fecha_ingreso` | Date NULL | `CB_FEC_ING`, normalizado a `date` (en TRESS es `datetime`) |
| `sincronizado_en` | DateTime(timezone=True) NOT NULL | `server_default=func.now()`, `onupdate=func.now()` |

`no_empleado` es la llave primaria directamente: hay a lo sumo una fila por colaborador y
no hace falta un autoincrement que solo agregaría una unique redundante.

**No se usa `String(50)` para `no_empleado`**, a diferencia de `levelup_turnos_empleados`.
Aquella columna es texto por herencia de listados de Excel; aquí el único origen es
`dbo.COLABORA`, donde `CB_CODIGO` es numérico.

### 2. Sync `sync_empleados_tress`

Réplica del patrón de `sync_turnos_empleados_service`: un servicio central, dos
disparadores contra la misma función.

- `app/services/sync_empleados_tress_service.py` con `sincronizar_empleados_tress(db, *, origen, execute, solo_no_empleado)`, `SyncEmpleadosTressStats` y el `asyncio.Lock` de módulo que impide que el job y el CLI se pisen.
- `app/repositories/sql/datos_analisis_colabora_datos_generales.sql`:
  `SELECT c.CB_CODIGO AS no_empleado, c.CB_FEC_ING AS fecha_ingreso FROM dbo.COLABORA c`.
- `app/scripts/sync_empleados_tress.py` — CLI, **dry-run salvo `--execute`**, con
  `--no-empleado` para una sola persona.
- Job diario **04:10** en `registrar_jobs_programados` (`app/main.py`), antes del de turno
  por empleado de las 04:20. No hay dependencia entre ambos; el orden solo agrupa las
  lecturas a TRESS en la misma ventana.

Tres reglas heredadas del sync de turnos, por las mismas razones:

- **Sin filtro `CB_ACTIVO`.** La Vista 360 se abre también sobre bajas, y una fecha de
  ingreso no deja de ser cierta cuando alguien se va. Es la diferencia deliberada frente a
  `datos_analisis_colabora_turnos.sql`, que sí filtra porque un turno de una baja no sirve
  para nada.
- **Solo se crean filas para números que existan en `empleados`.** Sembrar filas huérfanas
  llenaría la tabla de gente que Bono no conoce.
- **Nunca borra.** No hay reconciliación de bajas: si un `CB_CODIGO` deja de venir, su fila
  se queda. La alternativa —borrar— destruiría el dato sin ganar nada.

Aborta sin escribir si TRESS devuelve cero filas (`ValueError`), igual que `sync_turnos_uso`:
cero colaboradores es señal de consulta rota, no de planta vacía.

### 3. Lectura de la fecha de ingreso

`app/repositories/empleados_tress_repository.py` con
`EmpleadosTressRepository(db).get_fecha_ingreso(no_empleado) -> date | None`.

`usuario_service._obtener_fecha_ingreso_datos_analisis` se elimina; `get_vista_360` lee de
Bono. **Sin fila ⇒ `None`**, que es exactamente la degradación de hoy ante un fallo: la
Vista 360 nunca se rompe por este dato.

`DatosAnalisisColaboradorRepository` y `sql/datos_analisis_fecha_ingreso.sql` se retiran:
el sync usa su propio SQL y no queda otro consumidor.

### 4. Descansos proyectados desde Bono

Nueva función en `app/services/descansos_empleado_service.py`:

```python
async def obtener_descansos_bono(
    db: AsyncSession, *, cb_codigo: int, fecha_inicio: date, fecha_fin: date
) -> list[date]
```

Sustituye a `obtener_descansos_tress` conservando el contrato (lista ordenada de fechas) y
la validación de rango existente (`validar_rango_descansos`, máximo 366 días). Cuatro
lecturas a Bono, ninguna ODBC:

1. `levelup_turnos_empleados` → `tu_codigo` del empleado (por `no_empleado`, con el
   `turno_no_empleado_matches` que ya usa el resto del proyecto para salvar el
   `varchar`/`integer`).
2. `levelup_turnos` → el `Turno` de ese código → `turno_tress_desde_modelo()`.
3. `levelup_horarios` → dict `{ho_codigo: (entrada, salida, jornada)}`, solo con los
   códigos que el patrón rotativo o los `tu_hor_1..7` realmente usan.
4. `proyectar_calendario(turnos_por_fecha={f: turno for f in rango}, horarios=...)`
   → `fechas_descanso()`.

`proyectar_calendario` pierde su parámetro `ausencias_por_fecha` (ver §6): sin él, la
decisión 1 queda escrita en la firma de la función y no como un diccionario vacío que un
lector futuro leería como un olvido.

**Fail-closed con 503** (`ServiceUnavailableError`) en los cinco casos donde la proyección
no sería confiable, cada uno con su mensaje:

| caso | mensaje |
| --- | --- |
| sin fila en `levelup_turnos_empleados` | el turno de este empleado aún no se ha sincronizado |
| `tu_codigo` vacío o nulo | ídem |
| turno ausente de `levelup_turnos` | el turno *N* no está en el catálogo sincronizado |
| rotativo sin ancla válida (`ancla_valida` → `False`) | el turno es rotativo pero no tiene fecha de inicio de ciclo en nómina |
| patrón no interpretable o fecha anterior al ancla (`ValueError` de `proyectar_dia`) | no se pudo calcular el calendario de este turno |

Los mensajes son los que ya usa `comedor_ventana_comida_service` para las mismas dos
situaciones (`_AVISO_PATRON_INVALIDO`, `_AVISO_ANCLA_INVALIDA`), para que la planta no lea
dos redacciones distintas del mismo problema.

### 5. Los siete llamadores cambian juntos

`DescansosEmpleadoService.obtener_descansos`, `solicitud_service` (3 sitios) y
`faltas_retardos_service` (3 sitios) pasan a `obtener_descansos_bono`, tomando la sesión de
`self.db`.

**Se mueven los siete, no solo el endpoint.** Si el modal contara los días con la
proyección de Bono y el servidor los validara contra TRESS, ambas fuentes podrían
discrepar y el usuario vería su solicitud rechazada por un cálculo que la UI nunca le
mostró. Una sola fuente es la única forma de que el conteo del cliente y el del servidor no
se contradigan.

Los mensajes de dominio que hoy dicen «descanso aplicado en TRESS» pasan a decir
«descanso» a secas: ya no describen lo que nómina aplicó, sino lo que proyecta el turno.

### 6. Limpieza

- Se eliminan `app/repositories/datos_analisis_descansos_repository.py` y sus cuatro SQL
  (`datos_analisis_turnos_por_fecha.sql`, `datos_analisis_turno_por_codigo.sql`,
  `datos_analisis_ausencias_estatus_rango.sql`, `datos_analisis_horario_por_codigo.sql`).
- `parse_hora_tress` se muda a `app/utils/turno_calendario.py`, junto al resto del parseo
  de formatos de TRESS. Actualizan su import `comedor_ventana_comida_service` y la
  docstring de `app/models/horarios.py`.
- `aplicar_override_ausencia` queda sin llamador y se elimina, junto con el parámetro
  `ausencias_por_fecha` de `proyectar_calendario` y sus tests.

Al terminar, `DatosAnalisisReadClient` queda usado **solo** por los servicios de
sincronización, y `DatosAnalisisWriteClient` solo por los INSERT a nómina.

### 7. Migración

Una revisión de Alembic con un único `create_table("levelup_empleados_tress")`. No toca
ninguna tabla sin el prefijo `levelup_`.

### 8. Tests

- `tests/test_descansos_empleado.py` se **reescribe** contra tablas de Bono, con fixtures
  reales de `Turno` / `Horario` / `TurnoEmpleado`, en lugar de mockear el engine ODBC. Deja
  de ser un test que valida un doble en vez del camino real.
- `tests/test_solicitud_descansos.py`, `tests/test_faltas_retardos_goce.py`,
  `tests/test_goce_turno_rotativo.py` y `tests/test_faltas_retardos_suspension_tress.py`
  cambian su punto de parcheo de `obtener_descansos_tress` a `obtener_descansos_bono`.
- `tests/test_turno_calendario.py` pierde los casos de `aplicar_override_ausencia`.
- Nuevos: `tests/test_sync_empleados_tress.py` (upsert, sin borrado, aborto en cero filas,
  omisión de números ausentes en `empleados`) y un caso por cada uno de los cinco
  fail-closed de descansos.
- `tests/test_vista360_fecha_ingreso.py` pasa a sembrar `levelup_empleados_tress` y a
  cubrir el caso «sin fila ⇒ `None`».

## Riesgo de despliegue

Es el punto que puede hundir este cambio, y no es hipotético.

Hoy `/descansos` funciona para **cualquier** empleado porque va a TRESS en vivo. Después
dependerá de que `levelup_turnos_empleados` tenga cobertura. Hay registro en este proyecto
de que esa tabla llegó a tener **una sola fila**. Si en producción la cobertura fuera
parcial, este cambio convertiría un endpoint lento en un 503 masivo en el modal de nueva
solicitud — un fallo mucho peor que la latencia que se quiere eliminar.

Por eso, **antes de mergear**:

1. Correr `python -m app.scripts.sync_turnos_catalogo --execute` y
   `python -m app.scripts.sync_turnos_empleados --execute`.
2. Verificar la cobertura: cuántos empleados activos de Bono tienen fila con `tu_codigo` no
   vacío, y cuántos de esos códigos existen en `levelup_turnos`.
3. Si la cobertura no es prácticamente total, **esto no se despliega**; primero se corrige
   el sync.

El mismo paso aplica a `sync_empleados_tress`, aunque ahí el costo de una fila faltante es
solo un campo vacío en la Vista 360, no un bloqueo.

## Fuera de alcance

- **`sincronizado_en` en la respuesta de `/descansos`.** El proyecto expone ese campo en la
  API de turnos para avisar que se mira una foto. Aquí implicaría tocar `openapi.yaml` y
  los tipos del frontend; se deja para después.
- **El resto de `dbo.COLABORA`.** `levelup_empleados_tress` es el lugar obvio para fecha de
  baja o antigüedad, pero hoy nadie las pide.
- **Cachear Kardex o `dbo.AUSENCIA`.** Descartado en la decisión 1. Si algún día aparece un
  caso real de consulta histórica sobre alguien que cambió de turno, la vía es una tabla de
  **tramos de vigencia** de turno (no una fila por día).
- **Los dashboards de vacaciones, home office e incidencias.** Ya leen solo de Bono; este
  spec no los toca.

## Contrato de la API

Ninguno de los dos endpoints cambia su contrato: `/empleados/{id}/descansos` sigue
devolviendo `DescansosEmpleadoResponse` y `/usuarios/{id}/vista360` sigue devolviendo
`fecha_ingreso` como `date | null`. **`openapi.yaml` no se modifica.** Lo que cambia es de
dónde sale el dato y qué motivos pueden producir un 503.
