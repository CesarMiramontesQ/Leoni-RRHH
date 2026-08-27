-- Datos generales de cada colaborador de TRESS. SOLO LECTURA. Sin parametros.
--
-- Alimenta levelup_empleados_tress, de donde la Vista 360 lee la fecha de ingreso y de
-- donde la pagina Contratos lee el contrato actual. Ninguna carga de pagina pasa por
-- aqui; solo el sync de la madrugada.
--
-- CB_CODIGO corresponde a empleados.no_empleado en Bono. CB_FEC_ING y CB_FEC_CON son
-- datetime en TRESS y el servicio los normaliza a date.
--
-- Contrato actual = CB_CONTRAT (codigo) resuelto contra el catalogo dbo.CONTRATO.
-- TB_DIAS es la duracion en dias (0 = indefinido, no vence). El LEFT JOIN es deliberado
-- para que un codigo sin fila en el catalogo llegue con TB_DIAS NULL y se marque como
-- «sin dato» en vez de desaparecer del listado. El vencimiento NO se calcula aqui:
-- lo calcula el servicio, que tambien detecta la fecha vacia de TRESS (1899-12-30).
--
-- A diferencia de datos_analisis_colabora_turnos.sql, aqui se leen TODOS los empleados
-- (sin filtro de estado activo): la Vista 360 se abre tambien sobre bajas, y la fecha
-- de ingreso de quien se fue sigue siendo cierta. Un turno de una baja no sirve para nada;
-- su fecha de ingreso si.
--
-- Nota: no usar tokens con dos puntos en los comentarios; SQLAlchemy text() los toma
-- como parametros de enlace.
SELECT c.CB_CODIGO                 AS no_empleado,
       c.CB_FEC_ING                AS fecha_ingreso,
       LTRIM(RTRIM(c.CB_CONTRAT))  AS contrato_codigo,
       ct.TB_ELEMENT               AS contrato_descripcion,
       ct.TB_DIAS                  AS contrato_dias,
       c.CB_FEC_CON                AS fecha_contrato
FROM dbo.COLABORA c
LEFT JOIN dbo.CONTRATO ct
       ON ct.TB_CODIGO = c.CB_CONTRAT
WHERE c.CB_CODIGO IS NOT NULL;
