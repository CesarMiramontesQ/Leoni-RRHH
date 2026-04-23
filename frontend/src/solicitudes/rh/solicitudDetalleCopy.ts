/**
 * Textos de UI del modal de detalle de solicitud pendiente.
 * Centralizados para no dispersar literales en plantillas ni en lógica.
 */

export const SD_COPY = {
  tituloModal: "Detalle de solicitud",
  subtituloModal: "Revisión de información y decisión de aprobación",
  /** Vista empleado: sin acciones de aprobación. */
  subtituloModalSoloLectura: "Consulta de la información registrada en tu solicitud.",
  cerrarAria: "Cerrar modal",

  seccionEmpleado: "Info empleado",
  seccionSolicitud: "Info solicitud",
  seccionJerarquia: "Flujo jerárquico y aprobaciones",

  lblSupervisorAsignado: "Supervisor asignado",
  lblGerenteLinea: "Gerente de línea",
  lblEstadoSupervisor: "Estado del supervisor",
  lblEstadoGerencia: "Estado gerencia",

  supSinAsignar: "Sin supervisor asignado en el organigrama.",
  supPendienteAprobacion: "Pendiente de aprobación del supervisor directo.",
  supYaAprobo: "El supervisor directo ya aprobó en el sistema.",

  gerPendienteAprobacion: "Pendiente de aprobación del gerente de línea.",
  gerEsperaSiAplica: "Hay gerente de línea; la etapa de gerencia procede tras el supervisor.",
  gerSinEnCadena: "No hay gerente en la cadena de mando sobre el solicitante.",

  /** Solicitud propia (supervisor/gerente): sin botones de decisión jerárquica. */
  avisoAutopaprobacionBloqueada:
    "Esta solicitud es tuya: no puedes aprobarla ni rechazarla tú mismo. Debe actuar otro aprobador de la cadena.",

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
