/**
 * Textos del modal «Registrar nueva incidencia» (p. ej. `#/incidencias`).
 */

export const SNI_COPY = {
  titulo: "Registrar nueva incidencia",
  subtitulo: "Complete los detalles técnicos y administrativos del reporte.",
  secEmpleado: "Información del Empleado",
  secDetalle: "Detalles de la Incidencia",
  secEvidencia: "Personas y Evidencia",

  lblEmpleado: "Empleado",
  /** Placeholder del buscador (coincide con listados RH). */
  phEmpleado: "Buscar empleado...",
  lblEmpleadoSeleccionado: "Empleado seleccionado",
  empleadoAyuda: "Escribe nombre, número de empleado, correo o identificador. Elige un resultado de la lista.",
  empleadoBuscando: "Buscando…",
  empleadoSinResultados: "No hay coincidencias con tu búsqueda.",
  empleadoErrorCarga: "No se pudo cargar el listado de empleados.",
  empleadoRequerido: "Selecciona un empleado de la lista.",
  lblNoEmpleado: "Número de empleado",
  phNoEmpleado: "Se completa al elegir empleado",
  lblArea: "Área",
  phArea: "Departamento",
  lblSupervisor: "Supervisor",
  phSupervisor: "Nombre del jefe directo",
  lblRh: "Responsable RH",
  phRh: "Asignar gestor RH",

  lblTipo: "Tipo de Incidencia",
  phTipo: "Seleccionar tipo",
  lblFechaHora: "Fecha y Hora",
  lblPrioridad: "Prioridad",
  lblLugar: "Lugar exacto del evento",
  phLugar: "Especifique línea, almacén o planta",
  lblDescripcion: "Descripción detallada",
  phDescripcion: "Describa los hechos de manera objetiva...",

  lblPersonas: "Personas involucradas",
  phPersonas: "Nombres separados por comas",
  lblTestigos: "Testigos",
  phTestigos: "Nombres de testigos oculares",
  lblEvidencia: "Cargar Evidencia (Fotos, PDF, Video)",
  evidenciaSubir: "Subir un archivo",
  evidenciaDrag: "o arrastrar y soltar",
  evidenciaNota: "PNG, JPG, PDF hasta 10MB",

  cancelar: "Cancelar",
  guardar: "Guardar incidencia",
  cerrar: "Cerrar modal",

  toastGuardadoMock: "Incidencia registrada (simulación). Próximamente se enviará al servidor.",
} as const;
