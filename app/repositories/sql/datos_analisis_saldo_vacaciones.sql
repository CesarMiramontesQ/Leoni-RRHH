-- Saldo total de dias de gozo de un empleado desde la funcion TVF de TRESS
-- dbo.GET_SALDOS_VACACION(cb) (SQL Server datos-analisis, solo lectura).
-- Se usa la funcion directa (no la vista V_SALD_VAC, que calcula para todos via
-- GET_SALDOS_VACACION(-1) y luego filtra: ~2.4s vs ~5ms).
-- El bind cb_codigo = empleados.no_empleado (Integer). ISNULL => 0 si no hay periodos.
-- Nota: no usar tokens con dos puntos en comentarios; SQLAlchemy text() los toma como binds.
SELECT ISNULL(SUM(VS_S_GOZO), 0) AS saldo_gozo_total
FROM dbo.GET_SALDOS_VACACION(:cb_codigo);
