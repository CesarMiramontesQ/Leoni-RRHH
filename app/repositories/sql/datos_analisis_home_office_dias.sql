-- Dias de home office de un empleado en un rango, desde dbo.PERMISO
-- (SQL Server datos-analisis, solo lectura).
--
-- Home office = PM_TIPO 'HO' (catalogo dbo.INCIDEN, TB_CODIGO 'HO ' = "Home Ofice").
-- PM_TIPO es char(3) con padding, por eso el RTRIM.
--
-- Se filtra por PM_FEC_INI porque PM_FEC_FIN es EXCLUSIVA en TRESS (el insert guarda
-- DATEADD(day, 1, fecha_fin_real)); usarla para acotar el rango contaria de mas.
-- El rango es semiabierto -- desde incluido, hasta excluido -- para que el llamador
-- pase el 1 de enero del anio siguiente sin preocuparse por la hora.
--
-- Binds: cb_codigo = empleados.no_empleado (Integer), desde y hasta = date.
-- Nota: no usar tokens con dos puntos en comentarios; SQLAlchemy text() los toma como binds.
SELECT ISNULL(SUM(PM_DIAS), 0) AS dias_home_office
FROM dbo.PERMISO
WHERE CB_CODIGO = :cb_codigo
  AND RTRIM(PM_TIPO) = 'HO'
  AND PM_FEC_INI >= :desde
  AND PM_FEC_INI < :hasta;
