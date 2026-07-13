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
  /** Textos legacy (listados); flujo actual: una sola aprobación. */
  supPendienteAprobacion: "Pendiente de aprobación del supervisor directo.",
  supYaAprobo: "El supervisor directo ya aprobó en el sistema.",
  /** Modal jerarquía — solicitud pendiente (supervisor asignado). */
  supPuedeAprobarUnPaso: "Puede aprobar o rechazar como supervisor directo del solicitante.",
  /** Modal jerarquía — solicitud ya no pendiente. */
  supEstadoCerrada: "Referencia de organigrama (solicitud ya no pendiente).",

  gerPendienteAprobacion: "Pendiente de aprobación del gerente de línea.",
  gerEsperaSiAplica: "Hay gerente de línea; la etapa de gerencia procede tras el supervisor.",
  gerSinEnCadena: "No hay gerente en la cadena de mando sobre el solicitante.",
  gerPuedeAprobarUnPaso:
    "Puede aprobar o rechazar como gerente de línea o como gerente del equipo jerárquico del solicitante.",
  gerEstadoCerrada: "Referencia de organigrama (solicitud ya no pendiente).",

  jerarquiaUnaSolaAprobacion:
    "Basta una sola decisión: el supervisor directo o un gerente con alcance sobre el solicitante puede aprobar o rechazar (en cualquier orden). No se requiere segunda aprobación.",

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
  cargandoDetalle: "Cargando detalle…",

  errorNoPendiente: "Solo las solicitudes pendientes pueden abrirse desde el listado.",
  errorNoEncontrada: "No se encontró la solicitud.",

  /** `title` en filas pendientes de la tabla (accesibilidad). */
  tituloFilaPendiente: "Abrir detalle de la solicitud pendiente",
  tituloFilaCambiosSolicitados:
    "Solicitud con cambios solicitados — abrir para revisar o corregir",
} as const;
