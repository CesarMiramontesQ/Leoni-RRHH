-- Datos generales de cada colaborador de TRESS. SOLO LECTURA. Sin parametros.
--
-- Alimenta levelup_empleados_tress, de donde la Vista 360 lee la fecha de ingreso.
-- Ninguna carga de pagina pasa por aqui; solo el sync de la madrugada.
--
-- CB_CODIGO corresponde a empleados.no_empleado en Bono. CB_FEC_ING es datetime en TRESS
-- y el servicio lo normaliza a date.
--
-- A diferencia de datos_analisis_colabora_turnos.sql, aqui se leen TODOS los empleados
-- (sin filtro de estado activo): la Vista 360 se abre tambien sobre bajas, y la fecha
-- de ingreso de quien se fue sigue siendo cierta. Un turno de una baja no sirve para nada;
-- su fecha de ingreso si.
--
-- Nota: no usar tokens con dos puntos en los comentarios; SQLAlchemy text() los toma
-- como parametros de enlace.
SELECT c.CB_CODIGO  AS no_empleado,
       c.CB_FEC_ING AS fecha_ingreso
FROM dbo.COLABORA c
WHERE c.CB_CODIGO IS NOT NULL;
