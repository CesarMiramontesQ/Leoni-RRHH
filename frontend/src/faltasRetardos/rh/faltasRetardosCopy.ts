/**
 * Textos de UI — vista administrativa de faltas y retardos (módulo Laborales).
 */

export const FR_COPY = {
  tituloPagina: "Faltas y retardos",
  listadoTitulo: "Listado de eventos",
  listadoSubtitulo: (total: number) =>
    total === 1 ? "1 evento encontrado" : `${total} eventos encontrados`,
  listadoDetalleToggle: "Mostrar u ocultar listado completo",
  nuevo: "Nuevo registro",

  filtroBusqueda: "Buscar empleado",
  placeholderBusqueda: "Nombre o número de empleado",
  filtroTipo: "Tipo de evento",
  filtroFechaDesde: "Fecha desde",
  filtroFechaHasta: "Fecha hasta",
  optTodosTipos: "Todos los tipos",

  limpiarFiltros: "Limpiar filtros",
  aplicarFiltros: "Aplicar filtros",
  filtrosAplicadosHint: "Ajusta los campos y pulsa «Aplicar filtros» para consultar el servidor.",
  filtrosTitulo: "Filtros de búsqueda",
  filtrosSeccionAria: "Filtros de búsqueda",
  filtrosToggleMobile: "Filtros de búsqueda",

  tablaAria: "Listado de faltas y retardos",
  colNoEmpleado: "No empleado",
  colNombre: "Nombre",
  colTipo: "Tipo de evento",
  colFechas: "Fecha(s)",
  colObservaciones: "Observaciones",
  colRegistrado: "Fecha de registro",
  colUsuario: "Registrado por",

  cargandoTabla: "Cargando eventos…",
  tablaVaciaTitulo: "No se encontraron eventos",
  tablaVaciaDescripcion:
    "Intenta ajustar los filtros o registra un nuevo evento de asistencia.",
  errorTabla: "Error al cargar la tabla.",
  sinDatosTrasError: "Sin datos disponibles.",

  mostrando: (desde: number, hasta: number, total: number) =>
    `Mostrando ${desde} a ${hasta} de ${total} eventos`,
  anterior: "Anterior",
  siguiente: "Siguiente",
  paginaMaxHint: "Máximo 10 registros por página.",

  accesoDenegadoTitulo: "Acceso restringido",
  accesoDenegadoTexto:
    "La vista de faltas y retardos está disponible solo para usuarios con rol Recursos Humanos, director, gerente o supervisor.",

  estadisticasAria: "Estadísticas de faltas y retardos",
  errorEstadisticas: "No se pudieron cargar las estadísticas.",
  kpiTotal: "Total de eventos",
  kpiTotalSub: "Registros con los filtros aplicados",
  kpiFaltaJustificada: "Faltas justificadas",
  kpiFaltaJustificadaSub: "Ausencias con justificación",
  kpiFaltaInjustificada: "Faltas injustificadas",
  kpiFaltaInjustificadaSub: "Ausencias sin justificación",
  kpiRetardo: "Retardos",
  kpiRetardoSub: "Llegadas tarde registradas",
  kpiIncapacidad: "Incapacidades",
  kpiIncapacidadSub: "Bajas por incapacidad",
  kpiSuspension: "Suspensiones",
  kpiSuspensionSub: "Suspensiones laborales",

  metricasVacia: "No hay eventos de asistencia con los filtros seleccionados.",
  metricasSinDatos: "Sin datos de analítica disponibles.",
  metricasTendenciaTitulo: "Tendencia mensual",
  metricasTendenciaSub: "Eventos registrados por mes",
  metricasTipoTitulo: "Distribución por tipo",
  metricasTipoSub: "Composición de faltas y retardos",
  metricasEmpleadosTitulo: "Empleados con más eventos",
  metricasEmpleadosSub: "Top 10 según filtros aplicados",

  modalTitulo: "Nuevo registro",
  modalCerrar: "Cerrar",
  modalGuardar: "Registrar evento",
  modalGuardando: "Guardando…",
  modalExito: "El evento laboral se registró correctamente.",
} as const;
