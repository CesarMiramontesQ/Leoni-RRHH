-- KPIs de vacaciones de un empleado desde la funcion TVF de TRESS
-- dbo.GET_SALDOS_VACACION(cb) (SQL Server datos-analisis, solo lectura).
-- Se usa la funcion directa (no la vista V_SALD_VAC, que calcula para todos via
-- GET_SALDOS_VACACION(-1) y luego filtra: ~2.4s vs ~5ms).
--
-- Devuelve UNA fila con:
--   saldo_total      suma de VS_S_GOZO de TODOS los aniversarios (dias disponibles)
--   aniversario      VS_ANIV mas alto = ciclo vigente en TRESS
--   derecho_ciclo    VS_D_GOZO de ese ciclo (dias que le corresponden)
--   tomados_ciclo    VS_GOZO de ese ciclo (dias ya gozados)
--   vence            VS_FEC_VEN de ese ciclo (puede ser NULL)
-- Sin periodos devuelve saldo_total = 0 y el resto NULL.
--
-- El bind cb_codigo = empleados.no_empleado (Integer).
-- Nota: no usar tokens con dos puntos en comentarios; SQLAlchemy text() los toma como binds.
-- El LEFT JOIN contra la fila dummy garantiza SIEMPRE una fila: sin periodos, el
-- subselect del ciclo vigente esta vacio y las columnas salen NULL (en vez de que
-- la consulta entera devuelva cero filas).
WITH saldos AS (
    SELECT VS_ANIV, VS_D_GOZO, VS_GOZO, VS_S_GOZO, VS_FEC_VEN
    FROM dbo.GET_SALDOS_VACACION(:cb_codigo)
)
SELECT
    (SELECT ISNULL(SUM(VS_S_GOZO), 0) FROM saldos) AS saldo_total,
    vigente.VS_ANIV    AS aniversario,
    vigente.VS_D_GOZO  AS derecho_ciclo,
    vigente.VS_GOZO    AS tomados_ciclo,
    vigente.VS_FEC_VEN AS vence
FROM (SELECT 1 AS uno) AS fila_unica
LEFT JOIN (SELECT TOP 1 VS_ANIV, VS_D_GOZO, VS_GOZO, VS_FEC_VEN
           FROM saldos
           ORDER BY VS_ANIV DESC) AS vigente ON 1 = 1;
