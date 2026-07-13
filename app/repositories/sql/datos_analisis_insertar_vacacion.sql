-- Inserta vacaciones en dbo.VACACION (TRESS / datos-analisis) con validaciones.
-- Placeholders tipados (renderizados en Python, no binds ODBC): {{empleado}}, {{usuario}},
-- {{fecha_inicio}}, {{fecha_fin_mostrar}}, {{nom_tipo}}, {{dias_gozo}}, {{dias_pago}}, {{confirmar}}.
-- Devuelve una fila: ok (bit), codigo_error, mensaje, nueva_llave.
-- Nota: no usar tokens con dos puntos; SQLAlchemy text() los tomaria como binds.

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 30000;

DECLARE @Empleado           int          = {{empleado}};
DECLARE @Usuario            varchar(10)  = '{{usuario}}';
DECLARE @FechaInicio        date         = '{{fecha_inicio}}';
DECLARE @FechaFinMostrar    date         = '{{fecha_fin_mostrar}}';
DECLARE @NomTipo            smallint     = {{nom_tipo}};
DECLARE @DiasGozo           decimal(10,2)= {{dias_gozo}};
DECLARE @DiasPago           decimal(10,2)= {{dias_pago}};
DECLARE @Confirmar          bit          = {{confirmar}};

DECLARE @FechaFinExclusiva  date;
DECLARE @NomYear            int;
DECLARE @NomNume            int;
DECLARE @Salario            decimal(18,6);
DECLARE @TablaSS            varchar(10);
DECLARE @FecAnt             date;
DECLARE @Antiguedad         int;
DECLARE @SaldoGozo          decimal(10,2);
DECLARE @SaldoPago          decimal(10,2);
DECLARE @SaldoPrima         decimal(10,2);
DECLARE @TasaPrima          decimal(10,2);
DECLARE @DiasPrima          decimal(10,2);
DECLARE @VA_MONTO           decimal(18,6);
DECLARE @VA_SEVEN           decimal(18,6);
DECLARE @VA_PRIMA           decimal(18,6);
DECLARE @VA_TOTAL           decimal(18,6);
DECLARE @NuevaLlaveVacacion int;
DECLARE @CandadoResultado   varchar(10);
DECLARE @ConflictoResultado int;
DECLARE @TextoBitacora      nvarchar(200);
DECLARE @DataBitacora       nvarchar(500);
DECLARE @CodigoError        varchar(50) = NULL;
DECLARE @Mensaje            nvarchar(500) = N'';

SET @FechaFinExclusiva = DATEADD(DAY, 1, @FechaFinMostrar);

BEGIN TRY
  BEGIN TRAN;

  SELECT TOP 1
    @NomYear = PE_YEAR,
    @NomNume = PE_NUMERO
  FROM dbo.PERIODO
  WHERE PE_TIPO = @NomTipo
    AND PE_NUMERO < 200
    AND PE_CAL = 'S'
    AND @FechaInicio BETWEEN PE_ASI_INI AND PE_ASI_FIN
    AND @FechaFinMostrar BETWEEN PE_ASI_INI AND PE_ASI_FIN;

  IF @NomYear IS NULL OR @NomNume IS NULL
  BEGIN
    SET @CodigoError = 'SIN_PERIODO';
    SET @Mensaje = N'No hay periodo de nomina abierto que cubra las fechas de vacaciones.';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  SELECT
    @Salario = CB_SALARIO,
    @TablaSS = CB_TABLASS,
    @FecAnt  = CAST(CB_FEC_ANT AS date)
  FROM dbo.COLABORA
  WHERE CB_CODIGO = @Empleado
    AND CB_ACTIVO = 'S';

  IF @Salario IS NULL OR @FecAnt IS NULL
  BEGIN
    SET @CodigoError = 'EMPLEADO_NO_ENCONTRADO';
    SET @Mensaje = N'El empleado no existe o no esta activo en TRESS (COLABORA).';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  SET @Antiguedad = DATEDIFF(YEAR, @FecAnt, @FechaInicio);
  IF DATEADD(YEAR, @Antiguedad, @FecAnt) > @FechaInicio
    SET @Antiguedad = @Antiguedad - 1;
  IF @Antiguedad < 0
    SET @Antiguedad = 0;

  SELECT
    @SaldoGozo  = ISNULL(SUM(VS_S_GOZO), 0),
    @SaldoPago  = ISNULL(SUM(VS_S_PAGO), 0),
    @SaldoPrima = ISNULL(SUM(VS_S_PRIMA), 0)
  FROM dbo.GET_SALDOS_VACACION(@Empleado);

  IF @SaldoGozo < @DiasGozo OR @SaldoPago < @DiasPago
  BEGIN
    SET @CodigoError = 'SALDO_INSUFICIENTE';
    SET @Mensaje = N'Saldo de vacaciones insuficiente en TRESS (gozo o pago).';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  SELECT TOP 1 @TasaPrima = PT_PRIMAVA
  FROM dbo.PRESTACI
  WHERE TB_CODIGO = @TablaSS
    AND PT_YEAR <= @Antiguedad
  ORDER BY PT_YEAR DESC;

  IF @TasaPrima IS NULL
    SET @TasaPrima = 50;

  SET @DiasPrima = @DiasPago * (@TasaPrima / 100.0);

  IF @SaldoPrima < @DiasPrima
  BEGIN
    SET @CodigoError = 'SALDO_PRIMA_INSUFICIENTE';
    SET @Mensaje = N'Saldo de prima vacacional insuficiente en TRESS.';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  IF EXISTS (
    SELECT 1
    FROM dbo.VACACION
    WHERE CB_CODIGO = @Empleado
      AND VA_TIPO = 1
      AND VA_FEC_INI < @FechaFinExclusiva
      AND VA_FEC_FIN > @FechaInicio
  )
  BEGIN
    SET @CodigoError = 'TRASLAPE';
    SET @Mensaje = N'Ya existen vacaciones en TRESS que se traslapan con el rango solicitado.';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  SELECT TOP 1 @ConflictoResultado = RESULTADO
  FROM dbo.SP_STATUS_CONFLICTO(
    @Empleado,
    '18991230',
    @FechaInicio,
    @FechaFinMostrar,
    0
  );

  IF @ConflictoResultado IS NULL OR @ConflictoResultado <> 1
  BEGIN
    SET @CodigoError = 'CONFLICTO_STATUS';
    SET @Mensaje = N'Hay un conflicto de estatus en TRESS para las fechas indicadas.';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  SET @CandadoResultado = NULL;
  EXEC dbo.Validar_Movimiento_Vaca_Perm_Inca_Candado
    @Empleado,
    @FechaInicio,
    @FechaFinExclusiva,
    @FechaInicio,
    @FechaFinExclusiva,
    'VACA',
    @NomYear,
    @NomTipo,
    @NomNume,
    @NomYear,
    @NomTipo,
    @NomNume,
    1,
    @CandadoResultado OUTPUT;

  IF @CandadoResultado IS NULL OR @CandadoResultado <> 'N'
  BEGIN
    SET @CodigoError = 'CANDADO_NOMINA';
    SET @Mensaje = N'El movimiento esta bloqueado por candado de nomina en TRESS.';
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
    RETURN;
  END;

  SET @VA_MONTO = @Salario * @DiasPago;
  SET @VA_SEVEN = @VA_MONTO / 6.0;
  SET @VA_PRIMA = @Salario * @DiasPrima;
  SET @VA_TOTAL = @VA_MONTO + @VA_SEVEN + @VA_PRIMA;

  INSERT INTO dbo.VACACION (
    CB_CODIGO, VA_FEC_INI, VA_TIPO, VA_FEC_FIN, VA_COMENTA, VA_CAPTURA, US_CODIGO,
    VA_D_PAGO, VA_PAGO, VA_S_PAGO, VA_D_GOZO, VA_GOZO, VA_S_GOZO,
    CB_SALARIO, CB_TABLASS, VA_NOMYEAR, VA_NOMTIPO, VA_NOMNUME, VA_YEAR,
    VA_MONTO, VA_SEVEN, VA_TASA_PR, VA_PRIMA, VA_OTROS, VA_TOTAL,
    VA_PERIODO, VA_GLOBAL, VA_D_PRIMA, VA_P_PRIMA, VA_S_PRIMA, VA_AJUSTE
  ) VALUES (
    @Empleado, @FechaInicio, 1, @FechaFinExclusiva, '', CAST(GETDATE() AS date), @Usuario,
    0, @DiasPago, @SaldoPago - @DiasPago, 0, @DiasGozo, @SaldoGozo - @DiasGozo,
    @Salario, @TablaSS, @NomYear, @NomTipo, @NomNume, @Antiguedad,
    @VA_MONTO, @VA_SEVEN, @TasaPrima, @VA_PRIMA, 0, @VA_TOTAL,
    '', 'N', 0, @DiasPrima, @SaldoPrima - @DiasPrima, 'N'
  );

  SET @NuevaLlaveVacacion = SCOPE_IDENTITY();

  UPDATE dbo.COLABORA
  SET
    CB_V_GOZO  = ISNULL(CB_V_GOZO, 0) + @DiasGozo,
    CB_V_PAGO  = ISNULL(CB_V_PAGO, 0) + @DiasPago,
    CB_V_PRIMA = ISNULL(CB_V_PRIMA, 0) + @DiasPrima,
    CB_FEC_VAC = CASE
      WHEN CB_FEC_VAC IS NULL OR @FechaInicio > CB_FEC_VAC THEN @FechaInicio
      ELSE CB_FEC_VAC
    END
  WHERE CB_CODIGO = @Empleado;

  SET @TextoBitacora =
    N'Agregó Vacaciones del '
    + CONVERT(varchar(10), @FechaInicio, 103)
    + N' al '
    + CONVERT(varchar(10), @FechaFinMostrar, 103);

  SET @DataBitacora =
    N'Días Gozados: ' + CONVERT(varchar(20), @DiasGozo)
    + CHAR(13) + CHAR(10)
    + N'Días Pagados: ' + CONVERT(varchar(20), @DiasPago)
    + CHAR(13) + CHAR(10)
    + N'Días de prima vacacional pagada: ' + CONVERT(varchar(20), @DiasPrima);

  EXEC dbo.SP_INSERTAR_BITACORA
    @Usuario,
    0,
    0,
    0,
    @TextoBitacora,
    @Empleado,
    @DataBitacora,
    27,
    @FechaInicio;

  SET @Mensaje = N'Vacaciones registradas en TRESS.';

  IF @Confirmar = 1
    COMMIT TRAN;
  ELSE
  BEGIN
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    SET @Mensaje = N'Dry-run OK: validaciones e insert simulados; se hizo ROLLBACK.';
    SET @NuevaLlaveVacacion = NULL;
  END;

  SELECT CAST(1 AS bit) AS ok, CAST(NULL AS varchar(50)) AS codigo_error, @Mensaje AS mensaje, @NuevaLlaveVacacion AS nueva_llave;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  SET @CodigoError = 'SQL_ERROR';
  SET @Mensaje = ERROR_MESSAGE();
  SELECT CAST(0 AS bit) AS ok, @CodigoError AS codigo_error, @Mensaje AS mensaje, CAST(NULL AS int) AS nueva_llave;
END CATCH;
