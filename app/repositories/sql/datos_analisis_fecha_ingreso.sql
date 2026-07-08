-- Fecha de ingreso del colaborador desde la tabla base de TRESS
-- dbo.COLABORA (SQL Server datos-analisis, solo lectura).
-- El bind cb_codigo = empleados.no_empleado (Integer) cruza contra CB_CODIGO.
-- Nota: no usar tokens con dos puntos en comentarios; SQLAlchemy text() los toma como binds.
SELECT CB_FEC_ING AS fecha_ingreso
FROM dbo.COLABORA
WHERE CB_CODIGO = :cb_codigo;
