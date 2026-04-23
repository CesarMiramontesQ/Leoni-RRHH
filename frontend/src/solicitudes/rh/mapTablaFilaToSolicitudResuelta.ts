import type { SolicitudApiItem, SolicitudAprobacionApiItem } from "../../api/solicitudes.ts";
import { buildHistorialFromAprobaciones } from "./buildHistorialFromAprobaciones.ts";
import { calcularDiasSolicitadosInclusive } from "./rhNewRequestDays.ts";
import { SR_COPY } from "./solicitudResueltaCopy.ts";
import type {
  SolicitudHistorialItemVm,
  SolicitudHistorialTipo,
  SolicitudResueltaDetalleVm,
  SolicitudResueltaEstadoUi,
} from "./solicitudResueltaTypes.ts";
import type { RhSolicitudTablaFila } from "./types.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { fmtFechaCorta } from "../../ui/uiUtils.ts";

function fmtFechaHora(ts: number): string {
  return new Date(ts).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PerfilResuelta = {
  siguiente_paso?: string;
  puede_firmar: boolean;
  puede_cancelar: boolean;
  proceso_completado: boolean;
  comprobante_disponible: boolean;
  motivo_rechazo?: string;
  comentario_rechazo_largo?: string;
};

const PERFILES: Readonly<Record<number, Partial<PerfilResuelta>>> = {
  2940: {
    siguiente_paso: "Firma de Gerencia",
    puede_firmar: true,
    puede_cancelar: true,
    proceso_completado: false,
    comprobante_disponible: false,
  },
  2944: {
    proceso_completado: true,
    puede_firmar: false,
    puede_cancelar: false,
    comprobante_disponible: true,
  },
  2941: {
    motivo_rechazo: "No cumple con la antelación mínima requerida por política de RH para permisos de un día.",
    comentario_rechazo_largo:
      "No cumple con la antelación mínima requerida por política de RH para permisos de un día. El empleado debe solicitar con al menos 72 h de anticipación. Favor de reenviar cumpliendo el plazo o acudir con su supervisor para una excepción documentada.",
    comprobante_disponible: true,
  },
};

function perfilDefaultAprobada(): PerfilResuelta {
  return {
    siguiente_paso: "Firma de Gerencia",
    puede_firmar: true,
    puede_cancelar: true,
    proceso_completado: false,
    comprobante_disponible: false,
  };
}

function perfilDefaultRechazada(): PerfilResuelta {
  return {
    puede_firmar: false,
    puede_cancelar: false,
    proceso_completado: true,
    comprobante_disponible: false,
    motivo_rechazo: "Rechazado según revisión del aprobador.",
  };
}

function mergePerfil(id: number, base: PerfilResuelta): PerfilResuelta {
  const p = PERFILES[id];
  if (!p) return base;
  return { ...base, ...p };
}

type ItemAcc = { vm: SolicitudHistorialItemVm; ts: number };

function pushItem(
  acc: ItemAcc[],
  id: string,
  tipo: SolicitudHistorialTipo,
  titulo: string,
  actor_nombre: string,
  actor_rol: string,
  ts: number,
  comentario?: string,
): void {
  acc.push({
    ts,
    vm: {
      id,
      tipo,
      titulo,
      actor_nombre,
      actor_rol,
      fecha_hora: fmtFechaHora(ts),
      ...(comentario?.trim() ? { comentario: comentario.trim() } : {}),
    },
  });
}

function buildHistorialAprobada(row: RhSolicitudTablaFila, emp: string, sup: string): SolicitudHistorialItemVm[] {
  const acc: ItemAcc[] = [];
  const t0 = Date.parse(`${row.fecha_solicitud}T09:00:00`) || Date.now();
  const t1 = t0 + 86_400_000 * 1 + 36e5;
  const t2 = t1 + 86_400_000 + 2 * 36e5;
  const t3 = row.fecha_aprobacion
    ? Date.parse(`${row.fecha_aprobacion}T16:30:00`) || t2 + 36e5
    : t2 + 36e5;

  pushItem(
    acc,
    "h1",
    "creada",
    "Solicitud creada por empleado",
    emp,
    "Solicitante",
    t0,
    row.tipo === "vacaciones" ? "Motivo: descanso anual familiar" : "Motivo: modalidad acordada con el área",
  );
  pushItem(
    acc,
    "h2",
    "revisada",
    "Revisada por RRHH",
    "Carlos Ruiz",
    "Especialista Talento",
    t1,
    "Documentación y políticas verificadas.",
  );
  pushItem(
    acc,
    "h3",
    "aprobada",
    "Aprobada por supervisor",
    sup,
    "Supervisor directo",
    t3,
    "Periodo validado con calendario del equipo.",
  );

  return acc.sort((a, b) => b.ts - a.ts).map((x) => x.vm);
}

function buildHistorialRechazada(row: RhSolicitudTablaFila, emp: string, sup: string): SolicitudHistorialItemVm[] {
  const acc: ItemAcc[] = [];
  const t0 = Date.parse(`${row.fecha_solicitud}T09:15:00`) || Date.now();
  const t1 = t0 + 86_400_000 + 4 * 36e5;
  const t2 = t1 + 86_400_000 + 3 * 36e5;

  pushItem(acc, "h1", "creada", "Solicitud creada por empleado", emp, "Solicitante", t0);
  pushItem(
    acc,
    "h2",
    "revisada",
    "Revisada por RRHH",
    "Carlos Ruiz",
    "Especialista Talento",
    t1,
    "Registro conforme a políticas generales.",
  );
  pushItem(
    acc,
    "h3",
    "rechazada",
    "Rechazada por supervisor",
    sup,
    "Supervisor directo",
    t2,
    "No cumple antelación mínima para la fecha solicitada.",
  );

  return acc.sort((a, b) => b.ts - a.ts).map((x) => x.vm);
}

function ultimaActualizacionFmt(solicitud: SolicitudApiItem, aprobaciones: SolicitudAprobacionApiItem[]): string {
  let maxMs = Date.parse(solicitud.created_at);
  if (!Number.isFinite(maxMs)) maxMs = Date.now();
  for (const a of aprobaciones) {
    const t = Date.parse(a.timestamp);
    if (Number.isFinite(t) && t > maxMs) maxMs = t;
  }
  return fmtFechaHora(maxMs);
}

function tsOrZero(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function ultimoRechazo(aprobaciones: SolicitudAprobacionApiItem[]): SolicitudAprobacionApiItem | undefined {
  const rechazos = aprobaciones.filter((a) => a.accion === "reject");
  if (!rechazos.length) return undefined;
  return rechazos.reduce((a, b) => (tsOrZero(a.timestamp) >= tsOrZero(b.timestamp) ? a : b));
}

function ultimoRequestChanges(aprobaciones: SolicitudAprobacionApiItem[]): SolicitudAprobacionApiItem | undefined {
  const xs = aprobaciones.filter((a) => a.accion === "request_changes");
  if (!xs.length) return undefined;
  return xs.reduce((a, b) => (tsOrZero(a.timestamp) >= tsOrZero(b.timestamp) ? a : b));
}

export type MapTablaFilaToSolicitudResueltaOpciones = {
  soloLectura?: boolean;
  /** Sesión autenticada es el colaborador dueño de la fila (mismo `empleado_id` que la solicitud). */
  sesionEsCreador?: boolean;
  /** Si viene del GET por id, el historial se arma desde `aprobaciones` persistidas. */
  solicitudApi?: SolicitudApiItem;
  aprobaciones?: SolicitudAprobacionApiItem[];
};

/**
 * Construye la vista de detalle para filas resueltas o `changes_requested` (consulta).
 */
export function mapTablaFilaToSolicitudResuelta(
  row: RhSolicitudTablaFila,
  opciones?: MapTablaFilaToSolicitudResueltaOpciones,
): SolicitudResueltaDetalleVm | null {
  if (
    row.estado !== "approved" &&
    row.estado !== "rejected" &&
    row.estado !== "overridden" &&
    row.estado !== "changes_requested"
  ) {
    return null;
  }

  const emp = formatNombreEmpleadoUi(row.empleado_nombre_raw).trim() || row.empleado_nombre_raw.trim() || "—";
  const sup = formatNombreEmpleadoUi(row.supervisor_nombre).trim() || row.supervisor_nombre.trim() || "—";
  const folio = row.numero_folio.startsWith("#") ? row.numero_folio : `#${row.numero_folio}`;
  const total = calcularDiasSolicitadosInclusive(row.fecha_inicio, row.fecha_fin);
  const tipoAusencia =
    row.tipo === "vacaciones" ? SR_COPY.tipoVacacionesAnuales : SR_COPY.tipoHomeOffice;
  const titulo = row.tipo === "vacaciones" ? SR_COPY.tituloVacaciones : SR_COPY.tituloHomeOffice;

  const estado_ui: SolicitudResueltaEstadoUi =
    row.estado === "rejected" ? "rechazada"
    : row.estado === "changes_requested" ? "cambios_solicitados"
    : "aprobada";

  const perfilBase =
    estado_ui === "aprobada" ? perfilDefaultAprobada()
    : estado_ui === "cambios_solicitados" ?
      {
        puede_firmar: false,
        puede_cancelar: false,
        proceso_completado: true,
        comprobante_disponible: false,
        motivo_rechazo: "—",
      }
    : perfilDefaultRechazada();
  const perfil = mergePerfil(row.id, perfilBase);

  const solicitudApi = opciones?.solicitudApi;
  const aprobaciones = opciones?.aprobaciones ?? [];
  const usarHistorialServidor = solicitudApi != null;
  const sesionEsCreador = opciones?.sesionEsCreador === true;

  let historial: SolicitudHistorialItemVm[];
  let actualizado_en: string;
  let actualizado_relativo: string | undefined;

  if (usarHistorialServidor && solicitudApi) {
    historial = buildHistorialFromAprobaciones(solicitudApi, aprobaciones, row.empleado_nombre_raw);
    actualizado_en = ultimaActualizacionFmt(solicitudApi, aprobaciones);
    actualizado_relativo = undefined;
  } else if (estado_ui === "cambios_solicitados") {
    historial = [];
    actualizado_en = fmtFechaHora(Date.now() - 2 * 36e5);
    actualizado_relativo = SR_COPY.haceHoras(2);
  } else {
    historial =
      estado_ui === "aprobada" ? buildHistorialAprobada(row, emp, sup) : buildHistorialRechazada(row, emp, sup);
    actualizado_en = fmtFechaHora(Date.now() - 2 * 36e5);
    actualizado_relativo = SR_COPY.haceHoras(2);
  }

  const vm: SolicitudResueltaDetalleVm = {
    id: String(row.id),
    titulo,
    id_etiqueta: `${SR_COPY.idPrefijo} ${folio}`,
    estado_ui,
    tipo_codigo: row.tipo,
    empleado_nombre: emp,
    tipo_ausencia: tipoAusencia,
    departamento: row.area.trim() || "—",
    fecha_inicio: fmtFechaCorta(row.fecha_inicio),
    fecha_fin: fmtFechaCorta(row.fecha_fin),
    total_dias: total,
    actualizado_en,
    actualizado_relativo,
    puede_firmar: perfil.puede_firmar,
    puede_cancelar: perfil.puede_cancelar,
    proceso_completado: perfil.proceso_completado,
    comprobante_disponible: perfil.comprobante_disponible,
    ...(estado_ui === "cambios_solicitados" && sesionEsCreador ? { puede_corregir_y_reenviar: true as const } : {}),
    historial,
  };

  if (estado_ui === "aprobada" && !usarHistorialServidor && row.tipo !== "vacaciones") {
    if (perfil.proceso_completado) {
      vm.siguiente_paso = undefined;
      vm.historial = [
        {
          id: "h-fin",
          tipo: "finalizada",
          titulo: "Aprobación final",
          actor_nombre: "Sistema",
          actor_rol: "Registro",
          fecha_hora: fmtFechaHora(Date.now()),
          comentario: "Todas las etapas del flujo fueron completadas.",
        },
        ...historial,
      ];
    } else {
      vm.siguiente_paso = perfil.siguiente_paso;
      vm.historial = [
        {
          id: "h-pend",
          tipo: "firma_pendiente",
          titulo: "Firma de Gerencia pendiente",
          actor_nombre: "Pendiente",
          actor_rol: "Gerencia",
          fecha_hora: fmtFechaHora(Date.now() - 36e5),
        },
        ...historial,
      ];
    }
  }

  if (estado_ui === "aprobada" && usarHistorialServidor && row.tipo !== "vacaciones") {
    vm.siguiente_paso = perfil.siguiente_paso;
  }

  if (estado_ui === "aprobada" && row.tipo === "vacaciones") {
    vm.siguiente_paso = undefined;
    vm.puede_firmar = false;
    vm.puede_cancelar = false;
  }

  if (estado_ui === "cambios_solicitados" && usarHistorialServidor) {
    const uc = ultimoRequestChanges(aprobaciones);
    if (uc) {
      const por =
        formatNombreEmpleadoUi((uc.aprobador_nombre || "").trim()).trim() ||
        (uc.aprobador_nombre || "").trim() ||
        `Empleado #${uc.aprobador_id}`;
      vm.rechazado_por = por;
      vm.fecha_rechazo = fmtFechaHora(Date.parse(uc.timestamp));
      const c = typeof uc.comentario === "string" && uc.comentario.trim() ? uc.comentario.trim() : "";
      vm.motivo_rechazo = c || "—";
      vm.comentario_rechazo_largo = c || "—";
    } else {
      vm.motivo_rechazo = "—";
      vm.rechazado_por = sup;
      vm.fecha_rechazo = actualizado_en;
    }
  }

  if (estado_ui === "rechazada") {
    const ur = usarHistorialServidor ? ultimoRechazo(aprobaciones) : undefined;
    if (ur) {
      const por =
        formatNombreEmpleadoUi((ur.aprobador_nombre || "").trim()).trim() ||
        (ur.aprobador_nombre || "").trim() ||
        `Empleado #${ur.aprobador_id}`;
      vm.rechazado_por = por;
      vm.fecha_rechazo = fmtFechaHora(Date.parse(ur.timestamp));
      const c = typeof ur.comentario === "string" && ur.comentario.trim() ? ur.comentario.trim() : "";
      vm.motivo_rechazo = c || perfil.motivo_rechazo;
      vm.comentario_rechazo_largo = c || perfil.comentario_rechazo_largo || perfil.motivo_rechazo;
    } else {
      vm.motivo_rechazo = perfil.motivo_rechazo;
      vm.comentario_rechazo_largo = perfil.comentario_rechazo_largo ?? perfil.motivo_rechazo;
      vm.rechazado_por = sup;
      vm.fecha_rechazo = historial.find((h) => h.tipo === "rechazada")?.fecha_hora ?? actualizado_en;
    }
  }

  if (opciones?.soloLectura) {
    vm.puede_firmar = false;
    vm.puede_cancelar = false;
    vm.comprobante_disponible = false;
  }

  return vm;
}
