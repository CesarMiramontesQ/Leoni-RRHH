-- Saldo total de dias de gozo de vacaciones de un empleado desde la vista TRESS
-- dbo.V_SALD_VAC (SQL Server datos-analisis, solo lectura).
-- El bind cb_codigo = empleados.no_empleado (Integer). SUM sobre 0 filas => NULL.
-- Nota: no usar tokens con dos puntos en comentarios; SQLAlchemy text() los toma como binds.
SELECT SUM(VS_S_GOZO) AS saldo_gozo_total
FROM dbo.V_SALD_VAC
WHERE CB_CODIGO = :cb_codigo;
