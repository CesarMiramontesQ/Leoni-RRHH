-- Dias de home office tomados por empleado en un rango, desde dbo.PERMISO
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
-- No lleva filtro por empleado a proposito: el sync trae el anio completo de una vez y
-- recorta en memoria, de modo que la corrida masiva y la de un solo empleado comparten
-- exactamente esta consulta.
--
-- Binds: desde y hasta = date.
-- Nota: no usar tokens con dos puntos en comentarios; SQLAlchemy text() los toma como binds.
SELECT CB_CODIGO AS no_empleado,
       ISNULL(SUM(PM_DIAS), 0) AS dias_home_office
FROM dbo.PERMISO
WHERE RTRIM(PM_TIPO) = 'HO'
  AND PM_FEC_INI >= :desde
  AND PM_FEC_INI < :hasta
GROUP BY CB_CODIGO;
