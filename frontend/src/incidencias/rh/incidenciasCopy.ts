/**
 * Textos de UI — vista administrativa de incidencias laborales (rol RH).
 */

export const INC_COPY = {
  tituloPagina: "Incidencias",
  subtitulo:
    "Registro y seguimiento de incidencias disciplinarias y operativas.",
  exportar: "Exportar incidencias",
  nueva: "Nueva incidencia",
  filtrosAvanzadosAria: "Filtros avanzados",

  kpiAbiertas: "Incidencias abiertas",
  kpiInvestigacion: "En investigación",
  kpiResueltas: "Resueltas",
  kpiCriticas: "Críticas",

  errorMetricas: "No se pudieron calcular las métricas.",

  filtroArea: "Área",
  filtroEmpleado: "Empleado",
  placeholderBuscarEmpleado: "Buscar empleado...",
  tablaVaciaSugerenciaEmpleado:
    "Prueba con otro nombre, identificador o folio.",
  filtroSupervisor: "Supervisor",
  filtroTipo: "Tipo",
  filtroEstado: "Estado",
  filtroPeriodo: "Periodo",

  optTodasAreas: "Todas las áreas",
  optCualquierSupervisor: "Cualquiera",
  optTodosTipos: "Todos los tipos",
  optCualquierEstado: "Cualquier estado",
  optUltimos30: "Últimos 30 días",
  optUltimos90: "Últimos 90 días",
  optAnio: "Último año",
  optTodoPeriodo: "Todo el periodo",

  limpiarFiltros: "Limpiar filtros",

  tablaAria: "Listado de incidencias",
  filtrosSeccionAria: "Filtros de incidencias",
  colEmpleado: "Empleado",
  colNumero: "Número",
  colArea: "Área",
  colTipo: "Tipo",
  colFecha: "Fecha",
  colEstado: "Estado",
  colPrioridad: "Prioridad",

  cargandoTabla: "Cargando incidencias…",
  tablaVacia: "No hay incidencias con los filtros actuales.",
  errorTabla: "Error al cargar la tabla.",
  sinDatosTrasError: "Sin datos disponibles.",
  registrosPorPagina: "Registros por página",

  mostrando: (desde: number, hasta: number, total: number) =>
    `Mostrando ${desde} a ${hasta} de ${total} incidencias`,
  mostrandoCero: "Mostrando 0 de 0 incidencias",

  anterior: "Anterior",
  siguiente: "Siguiente",

  toastExportMock: "Exportación de incidencias (mock) iniciada.",
  toastNuevaMock: "Flujo de nueva incidencia (mock).",
  toastFiltrosAvMock: "Filtros avanzados (próximamente).",

  accesoDenegadoTitulo: "Acceso restringido",
  accesoDenegadoTexto:
    "La vista de incidencias laborales está disponible solo para usuarios con rol Recursos Humanos, gerente o supervisor.",
  volverDashboard: "Volver al dashboard",

  sinNombre: "Sin nombre",

  cardReportante: "Información del empleado reportante",
  cardDetalle: "Detalle de la incidencia",
  cardEvidencia: (n: number) => `Evidencia (${n})`,
  cardPersonal: "Personal involucrado",
  cardDescCompleta: "Descripción completa",
  cardLblNombre: "Nombre completo",
  cardLblIdEmpleado: "ID de empleado",
  cardLblArea: "Área / departamento",
  cardLblPuesto: "Puesto",
  cardLblSupervisor: "Supervisor directo",
  cardLblTipo: "Tipo",
  cardLblFechaHora: "Fecha y hora",
  cardLblUbicacion: "Ubicación",
  cardEstado: "Estado",
  cardIdReporte: "ID de reporte",
  cardPrioridad: "Prioridad",
  cardSlaTiempo: "Tiempo transcurrido",
  cardSlaObjetivo: (h: number) => `(SLA: ${h}H)`,
  cardSlaDentro: "Dentro de tiempo",
  cardSlaFuera: "Fuera de tiempo",
  cardSlaProgreso: "Progreso SLA",
  cardVerHistorial: "Ver historial de registro",
  cardSinEvidencias: "Sin evidencias adjuntas.",
  cardSinPersonal: "Sin personal adicional registrado.",
  cardDescargaAria: "Descargar archivo",
  badgeRolTestigo: "Testigo",
  badgeRolAfectado: "Afectado",
  badgeRolInvolucrado: "Involucrado",
  toastHistorialMock: "Historial de registro (próximamente).",
  toastDescargaMock: "Descarga de evidencia (simulación).",

  detalleModalTitulo: "Detalle de incidencia",
  detalleModalCerrar: "Cerrar detalle",

  estadoCerrada: "Cerrada",
  cardSlaHistoricoTitulo: "SLA (histórico)",
  cardSlaHistoricoDescripcion:
    "Caso cerrado. El seguimiento de tiempo de respuesta quedó registrado para auditoría.",
  cardSlaHistoricoFinalizado: "SLA finalizado",
  cardSlaTiempoTotal: "Tiempo total registrado",
} as const;
