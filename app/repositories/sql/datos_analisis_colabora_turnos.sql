-- Turno vigente de cada colaborador activo. SOLO LECTURA. Sin parametros.
--
-- Alimenta levelup_turnos_empleados, que es de donde sale el turno con el que se resuelve
-- la ventana de comida de una persona. Ninguna carga de pagina pasa por aqui; solo el
-- sync de la madrugada.
--
-- CB_CODIGO corresponde a empleados.no_empleado en Bono. CB_TURNO es char(6) con relleno
-- y se normaliza aqui, porque la columna destino guarda el codigo ya normalizado.
--
-- Es una foto del turno de HOY: TRESS guarda el historico de cambios de turno en el
-- kardex, no en COLABORA. Consultar una fecha pasada de alguien que cambio de rotacion
-- devuelve su turno actual, no el que tenia entonces; por eso la respuesta de la API
-- expone la fecha del sync.
--
-- Nota: no usar tokens con dos puntos en los comentarios; SQLAlchemy text() los toma
-- como parametros de enlace.
SELECT c.CB_CODIGO      AS no_empleado,
       RTRIM(c.CB_TURNO) AS tu_codigo
FROM dbo.COLABORA c
WHERE RTRIM(c.CB_ACTIVO) = 'S'
  AND c.CB_TURNO IS NOT NULL
  AND RTRIM(c.CB_TURNO) <> '';
