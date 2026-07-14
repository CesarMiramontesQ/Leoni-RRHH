-- Inserta home office en dbo.PERMISO (TRESS / datos-analisis) con validaciones.
-- Placeholders tipados (renderizados en Python, no binds ODBC): {{empleado}}, {{usuario}},
-- {{fecha_inicio}}, {{fecha_fin_mostrar}}, {{confirmar}}.
-- Devuelve una fila: ok (bit), codigo_error, mensaje, nueva_llave.
-- Nota: no usar tokens con dos puntos; SQLAlchemy text() los tomaria como binds.

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 30000;

DECLARE @Empleado           int          = {{empleado}};
DECLARE @Usuario            smallint     = {{usuario}};
DECLARE @FechaInicio        date         = '{{fecha_inicio}}';
DECLARE @FechaFinMostrar    date         = '{{fecha_fin_mostrar}}';
DECLARE @Confirmar          bit          = {{confirmar}};

DECLARE @FechaFinExclusiva  date;
DECLARE @Dias               smallint;
DECLARE @Texto              varchar(255);
DECLARE @Data               varchar(max);
DECLARE @NuevaLlave         int;
DECLARE @CodigoError        varchar(50) = NULL;
DECLARE @Mensaje            nvarchar(500) = N'';

SET @FechaFinExclusiva = DATEADD(day, 1, @FechaFinMostrar);
SET @Dias = DATEDIFF(day, @FechaInicio, @FechaFinExclusiva);

BEGIN TRY
  BEGIN TRAN;

  IF NOT EXISTS (
    SELECT 1
    FROM dbo.COLABORA
    WHERE CB_CODIGO = @Empleado
  )
  BEGIN
    SET @CodigoError = 'EMPLEADO_NO_ENCONTRADO';
    SET @Mensaje = N'El empleado no existe en COLABORA.';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  IF @FechaFinMostrar < @FechaInicio OR @Dias <= 0
  BEGIN
    SET @CodigoError = 'FECHA_INVALIDA';
    SET @Mensaje = N'La fecha final no puede ser menor que la fecha inicial.';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  IF EXISTS (
    SELECT 1
    FROM dbo.PERMISO WITH (UPDLOCK, HOLDLOCK)
    WHERE
      CB_CODIGO = @Empleado
      AND PM_FEC_INI < @FechaFinExclusiva
      AND PM_FEC_FIN > @FechaInicio
  )
  BEGIN
    SET @CodigoError = 'TRASLAPE_PERMISO';
    SET @Mensaje = N'Ya existe un permiso para el empleado en ese rango.';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  IF EXISTS (
    SELECT 1
    FROM dbo.VACACION WITH (UPDLOCK, HOLDLOCK)
    WHERE
      CB_CODIGO = @Empleado
      AND VA_TIPO = 1
      AND VA_FEC_INI < @FechaFinExclusiva
      AND VA_FEC_FIN > @FechaInicio
  )
  BEGIN
    SET @CodigoError = 'TRASLAPE_VACACION';
    SET @Mensaje = N'El empleado ya tiene vacaciones en ese rango.';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  IF EXISTS (
    SELECT 1
    FROM dbo.INCAPACI WITH (UPDLOCK, HOLDLOCK)
    WHERE
      CB_CODIGO = @Empleado
      AND IN_FEC_INI < @FechaFinExclusiva
      AND IN_FEC_FIN > @FechaInicio
  )
  BEGIN
    SET @CodigoError = 'TRASLAPE_INCAPACIDAD';
    SET @Mensaje = N'El empleado ya tiene incapacidad en ese rango.';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  INSERT INTO dbo.PERMISO (
    CB_CODIGO,
    PM_FEC_INI,
    PM_CLASIFI,
    PM_COMENTA,
    PM_DIAS,
    PM_FEC_FIN,
    PM_CAPTURA,
    US_CODIGO,
    PM_TIPO,
    PM_NUMERO,
    PM_GLOBAL,
    AX_FECHA,
    PM_BAN_ID
  )
  VALUES (
    @Empleado,
    @FechaInicio,
    0,
    'HOME OFFICE',
    @Dias,
    @FechaFinExclusiva,
    CAST(GETDATE() AS date),
    @Usuario,
    'HO',
    'HO',
    'N',
    '18991230',
    0
  );

  SET @NuevaLlave = SCOPE_IDENTITY();

  SET @Texto =
    'Agregó Permiso De ' +
    CAST(@Dias AS varchar(10)) +
    ' Días Con Goce - Home Office';

  SET @Data =
    'Tipo: HO - Home Ofice' + CHAR(13) + CHAR(10) +
    'Del: ' + CONVERT(varchar(10), @FechaInicio, 103) + CHAR(13) + CHAR(10) +
    'Al: ' + CONVERT(varchar(10), @FechaFinMostrar, 103);

  EXEC dbo.SP_INSERTAR_BITACORA
    @Usuario,
    0,
    0,
    0,
    @Texto,
    @Empleado,
    @Data,
    5,
    @FechaInicio;

  SET @Mensaje = N'Home office registrado en TRESS.';

  IF @Confirmar = 1
    COMMIT TRAN;
  ELSE
  BEGIN
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SET @Mensaje = N'Dry-run OK: validaciones e insert simulados; se hizo ROLLBACK.';
    SET @NuevaLlave = NULL;
  END;

  SELECT CAST(1 AS bit) AS ok, CAST(NULL AS varchar(50)) AS codigo_error, @Mensaje AS mensaje, @NuevaLlave AS nueva_llave;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  SET @CodigoError = 'ERROR_SQL';
  SET @Mensaje = ERROR_MESSAGE();
  SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
END CATCH;
