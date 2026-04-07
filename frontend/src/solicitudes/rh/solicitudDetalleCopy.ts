/**
 * Textos de UI del modal de detalle de solicitud pendiente.
 * Centralizados para no dispersar literales en plantillas ni en lógica.
 */

export const SD_COPY = {
  tituloModal: "Detalle de solicitud",
  subtituloModal: "Revisión de información y decisión de aprobación",
  cerrarAria: "Cerrar modal",

  seccionEmpleado: "Info empleado",
  seccionSolicitud: "Info solicitud",

  lblNombre: "Nombre",
  lblIdEmpleado: "ID de empleado",
  lblArea: "Área",
  lblPuesto: "Puesto",
  lblSupervisor: "Supervisor",

  lblTipoSolicitud: "Tipo de solicitud",
  lblFechaInicio: "Fecha inicio",
  lblFechaFin: "Fecha fin",
  lblTotalDias: "Total de días",
  lblComentarioEmpleado: "Comentario del empleado",
  lblSaldoActual: "Saldo actual",
  lblRestante: "Restante",
  diasUnidad: "días",

  sinComentarioEmpleado: "Sin comentario del empleado.",

  badgeVacacionesPendiente: "VACACIONES PENDIENTES",
  badgeHomeOfficePendiente: "HOME OFFICE PENDIENTE",

  accionAprobar: "Aprobar solicitud",
  accionCambios: "Cambios",
  accionRechazar: "Rechazar",
  toggleComentarioInterno: "Agregar comentario interno",
  placeholderComentarioInterno: "Notas para auditoría o seguimiento interno…",
  ayudaComentarioInterno: "Visible solo para el equipo de RH y aprobadores.",

  validacionComentarioRequerido: "Indica un comentario interno para rechazar o solicitar cambios.",
  errorProcesar: "No se pudo completar la acción. Intenta de nuevo.",
  exitoAprobar: "Solicitud aprobada.",
  exitoCambios: "Se solicitó revisión con cambios.",
  exitoRechazar: "Solicitud rechazada.",

  procesando: "Procesando…",
  cargandoDetalle: "Cargando detalle…",

  errorNoPendiente: "Solo las solicitudes pendientes pueden abrirse desde el listado.",
  errorNoEncontrada: "No se encontró la solicitud.",

  /** `title` en filas pendientes de la tabla (accesibilidad). */
  tituloFilaPendiente: "Abrir detalle de la solicitud pendiente",
} as const;
