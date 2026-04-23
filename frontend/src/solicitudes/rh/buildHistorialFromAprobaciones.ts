import type { SolicitudApiItem, SolicitudAprobacionApiItem } from "../../api/solicitudes.ts";
import { SR_COPY } from "./solicitudResueltaCopy.ts";
import type { SolicitudHistorialItemVm, SolicitudHistorialTipo } from "./solicitudResueltaTypes.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";

function fmtFechaHora(isoOrTs: string | number): string {
  const d = typeof isoOrTs === "number" ? new Date(isoOrTs) : new Date(isoOrTs);
  if (Number.isNaN(d.getTime())) return String(isoOrTs);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function accionToTipoYTitulo(accion: string): { tipo: SolicitudHistorialTipo; titulo: string } {
  if (accion === "approve") {
    return { tipo: "aprobada", titulo: SR_COPY.historialTituloAprobada };
  }
  if (accion === "reject") {
    return { tipo: "rechazada", titulo: SR_COPY.historialTituloRechazada };
  }
  if (accion === "override") {
    return { tipo: "aprobada", titulo: SR_COPY.historialTituloOverride };
  }
  if (accion === "request_changes") {
    return { tipo: "revisada", titulo: SR_COPY.historialTituloCambiosSolicitados };
  }
  return { tipo: "aprobada", titulo: accion };
}

/**
 * Línea de tiempo persistida: alta de solicitud + filas de `solicitud_aprobaciones` (orden reciente primero).
 */
export function buildHistorialFromAprobaciones(
  solicitud: SolicitudApiItem,
  aprobaciones: SolicitudAprobacionApiItem[],
  nombreEmpleadoFilaFallback: string,
): SolicitudHistorialItemVm[] {
  const nombreApi = typeof solicitud.empleado_nombre === "string" ? solicitud.empleado_nombre.trim() : "";
  const empRaw = nombreApi || nombreEmpleadoFilaFallback.trim() || "";
  const solicitante =
    formatNombreEmpleadoUi(empRaw).trim() || empRaw.trim() || SR_COPY.historialActorDesconocido;

  const createdTs = Date.parse(solicitud.created_at);
  const createdMs = Number.isFinite(createdTs) ? createdTs : Date.now();
  const comentarioCreacion =
    typeof solicitud.comentarios === "string" && solicitud.comentarios.trim() ?
      solicitud.comentarios.trim()
    : undefined;

  const events: { ts: number; vm: SolicitudHistorialItemVm }[] = [
    {
      ts: createdMs,
      vm: {
        id: "h-creada",
        tipo: "creada",
        titulo: SR_COPY.historialTituloRegistrada,
        actor_nombre: solicitante,
        actor_rol: SR_COPY.historialRolSolicitante,
        fecha_hora: fmtFechaHora(solicitud.created_at),
        ...(comentarioCreacion ? { comentario: comentarioCreacion } : {}),
      },
    },
  ];

  for (const a of aprobaciones) {
    const ts = Date.parse(a.timestamp);
    const ms = Number.isFinite(ts) ? ts : createdMs + 1;
    const nomRaw = (a.aprobador_nombre && a.aprobador_nombre.trim()) || "";
    const actor =
      formatNombreEmpleadoUi(nomRaw).trim() || nomRaw || `Empleado #${a.aprobador_id}`;
    const { tipo, titulo } = accionToTipoYTitulo(a.accion);
    const com = typeof a.comentario === "string" && a.comentario.trim() ? a.comentario.trim() : undefined;
    events.push({
      ts: ms,
      vm: {
        id: `h-apr-${a.id}`,
        tipo,
        titulo,
        actor_nombre: actor,
        actor_rol: SR_COPY.historialRolAprobadorNivel(a.nivel),
        fecha_hora: fmtFechaHora(a.timestamp),
        ...(com ? { comentario: com } : {}),
      },
    });
  }

  events.sort((x, y) => y.ts - x.ts);
  return events.map((e) => e.vm);
}
