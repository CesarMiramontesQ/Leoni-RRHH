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

  /** Solicitud propia (supervisor/gerente): sin botones de decisión jerárquica. */
  avisoAutopaprobacionBloqueada:
    "Esta solicitud es tuya: no puedes aprobarla ni rechazarla tú mismo. Debe actuar otro aprobador de la cadena.",

  lblNombre: "Nombre",
  lblIdEmpleado: "Número de empleado",
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
  listadoRecargaError:
    "La decisión se guardó, pero no se pudo actualizar la tabla. Recarga la página si no ves el cambio.",
  exitoAprobar: "Solicitud aprobada.",
  exitoCambios: "Se solicitó revisión con cambios.",
  exitoRechazar: "Solicitud rechazada.",

  procesando: "Procesando…",
  agregandoVacaciones: "Agregando vacaciones",
  agregandoVacacionesHint: "Registrando en nómina TRESS. Esto puede tardar unos segundos…",
  agregandoHomeOffice: "Insertando home office",
  agregandoHomeOfficeHint: "Registrando permiso HO en nómina TRESS. Esto puede tardar unos segundos…",
  cargandoDetalle: "Cargando detalle…",

  errorNoPendiente: "Solo las solicitudes pendientes pueden abrirse desde el listado.",
  errorNoEncontrada: "No se encontró la solicitud.",

  /** `title` en filas pendientes de la tabla (accesibilidad). */
  tituloFilaPendiente: "Abrir detalle de la solicitud pendiente",
  tituloFilaCambiosSolicitados:
    "Solicitud con cambios solicitados — abrir para revisar o corregir",
} as const;
