/**
 * Textos de UI — modal de detalle de solicitud resuelta (aprobada / rechazada).
 */

export const SR_COPY = {
  cerrarAria: "Cerrar modal",
  cargando: "Cargando detalle…",
  errorCarga: "No se pudo cargar el detalle de la solicitud.",
  vacio: "No hay información para mostrar.",
  actualizado: "Actualizado",
  haceHoras: (n: number) => `hace ${n} hora${n === 1 ? "" : "s"}`,

  seccionHistorial: "Historial de aprobación",

  historialTituloRegistrada: "Solicitud registrada",
  historialTituloAprobada: "Solicitud aprobada",
  historialTituloRechazada: "Solicitud rechazada",
  historialTituloOverride: "Aprobación administrativa (override)",
  historialTituloCambiosSolicitados: "Cambios solicitados por el aprobador",
  historialRolSolicitante: "Solicitante",
  historialRolAprobadorNivel: (nivel: number) => `Aprobador · nivel ${nivel}`,
  historialActorDesconocido: "—",

  cardGeneral: "Información general",
  cardPeriodo: "Período solicitado",
  lblEmpleado: "Empleado",
  lblTipoAusencia: "Tipo de ausencia",
  lblDepartamento: "Departamento",
  lblDesde: "Desde",
  lblHasta: "Hasta",
  lblTotalDias: "Total de días",
  diasLaborales: (n: number) => `${n} día${n === 1 ? "" : "s"} laborales`,

  badgeAprobado: "APROBADO",
  badgeRechazado: "RECHAZADO",
  badgeCambiosSolicitados: "CAMBIOS SOLICITADOS",

  bloqueCambiosTitulo: "Instrucciones del aprobador",
  lblSolicitoCambios: "Solicitó los cambios",

  tituloVacaciones: "Solicitud de vacaciones",
  tituloHomeOffice: "Solicitud de home office",
  tipoVacacionesAnuales: "Vacaciones anuales",
  tipoHomeOffice: "Home office",
  idPrefijo: "ID:",

  siguientePaso: "Siguiente paso:",
  procesoCompletado: "El proceso de esta solicitud ha finalizado. No hay acciones pendientes.",

  btnFirmar: "Firmar documento",
  btnCancelar: "Cancelar",
  btnImprimir: "Imprimir",
  btnCerrar: "Cerrar",
  btnVerComentario: "Ver comentario completo",
  btnOcultarComentario: "Ocultar comentario completo",
  btnDescargar: "Descargar comprobante",
  btnCorregirYReenviar: "Editar y reenviar a aprobación",

  bloqueRechazoTitulo: "Motivo del rechazo",
  lblResponsable: "Responsable",
  lblFechaRechazo: "Fecha del rechazo",

  toastFirmarMock: "Acción de firma (mock) registrada.",
  toastCancelarMock: "Proceso cancelado (mock).",
  toastDescargaMock: "Descarga de comprobante (mock).",

  tituloFilaResuelta: "Ver detalle de la solicitud",

  errorNoResuelta: "Solo se puede consultar el detalle de solicitudes aprobadas o rechazadas.",
  errorNoEncontrada: "No se encontró la solicitud.",
};
