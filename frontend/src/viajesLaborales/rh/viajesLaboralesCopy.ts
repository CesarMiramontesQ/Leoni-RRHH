export const VL_COPY = {
  tituloPagina: "Viajes laborales",
  listadoTitulo: "Listado de viajes",
  listadoSubtitulo: (total: number) =>
    total === 1 ? "1 viaje encontrado" : `${total} viajes encontrados`,
  listadoDetalleToggle: "Mostrar u ocultar listado completo",
  nuevo: "Nuevo viaje",

  filtroBusqueda: "Buscar empleado",
  placeholderBusqueda: "Nombre o número de empleado",
  filtroDestino: "Destino",
  placeholderDestino: "Ciudad o lugar de destino",
  filtroEstado: "Estado",
  filtroFechaDesde: "Salida desde",
  filtroFechaHasta: "Salida hasta",
  optTodosEstados: "Todos los estados",

  limpiarFiltros: "Limpiar filtros",
  aplicarFiltros: "Aplicar filtros",
  filtrosTitulo: "Filtros de búsqueda",

  tablaAria: "Listado de viajes laborales",
  colEmpleado: "Empleado",
  colFechas: "Fechas",
  colRuta: "Origen → Destino",
  colTransporte: "Transporte",
  colViaticos: "Viáticos est.",
  colEstado: "Estado",
  colAcciones: "Acciones",

  cargandoTabla: "Cargando viajes…",
  tablaVaciaTitulo: "No se encontraron viajes",
  tablaVaciaDescripcion: "Ajusta los filtros o registra un nuevo viaje laboral.",
  errorTabla: "Error al cargar la tabla.",
  sinDatosTrasError: "Sin datos disponibles.",

  mostrando: (desde: number, hasta: number, total: number) =>
    `Mostrando ${desde} a ${hasta} de ${total} viajes`,
  anterior: "Anterior",
  siguiente: "Siguiente",

  accesoDenegadoTitulo: "Acceso restringido",
  accesoDenegadoTexto:
    "La vista de viajes laborales está disponible solo para Recursos Humanos o para quien tenga este módulo asignado.",

  estadisticasAria: "Estadísticas de viajes laborales",
  errorEstadisticas: "No se pudieron cargar las estadísticas.",
  kpiTotal: "Total de viajes",
  kpiPendientes: "Pendientes",
  kpiAprobados: "Aprobados",
  kpiCancelados: "Cancelados",

  accVer: "Ver",
  accEditar: "Editar",
  accEnviar: "Enviar",
  accReenviar: "Reenviar",
  accAprobar: "Aprobar",
  accRechazar: "Rechazar",
  accCancelar: "Cancelar",
  accEliminar: "Eliminar",

  modalTituloNuevo: "Nuevo viaje laboral",
  modalTituloEditar: "Editar viaje laboral",
  modalDetalleTitulo: "Detalle del viaje",
  modalCerrar: "Cerrar",
  modalGuardar: "Guardar",
  modalGuardando: "Guardando…",
  modalExitoCrear: "El viaje se registró correctamente.",
  modalExitoEditar: "El viaje se actualizó correctamente.",

  confirmEliminar: "¿Eliminar este viaje en borrador? Esta acción no se puede deshacer.",
  confirmCancelar: "¿Cancelar este viaje laboral?",
  motivoRechazoLabel: "Motivo del rechazo",
  motivoRechazoPlaceholder: "Indique el motivo del rechazo",
} as const;
