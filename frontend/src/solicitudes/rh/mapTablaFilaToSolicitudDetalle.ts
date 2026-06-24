import { calcularDiasSolicitadosInclusive } from "./rhNewRequestDays.ts";
import { SD_COPY } from "./solicitudDetalleCopy.ts";
import { getSolicitudDetalleMockExtra } from "./solicitudDetalleMockExtras.ts";
import type { SolicitudDetallePendienteVm } from "./solicitudDetalleTypes.ts";
import type { RhSolicitudTablaFila } from "./types.ts";
import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";

function fmtFechaDisplay(iso: string): string {
  const p = iso.trim().split("-");
  if (p.length !== 3) return iso;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export type MapTablaFilaToSolicitudDetalleOpciones = {
  /** Rol empleado: datos de referencia sin cupo simulado ni acciones de aprobación. */
  soloLectura?: boolean;
};

/**
 * Construye la vista de detalle para una fila pendiente (mock + fila de tabla).
 */
export function mapTablaFilaToSolicitudDetallePendiente(
  row: RhSolicitudTablaFila,
  opciones?: MapTablaFilaToSolicitudDetalleOpciones,
): SolicitudDetallePendienteVm | null {
  if (row.estado !== "pending") return null;
  const soloLectura = opciones?.soloLectura ?? false;
  const extra = getSolicitudDetalleMockExtra(row.id);
  const nombre = formatNombreEmpleadoUi(row.empleado_nombre_raw).trim() || row.empleado_nombre_raw.trim() || "Sin nombre";
  const supervisor =
    formatNombreEmpleadoUi(row.supervisor_nombre).trim() || row.supervisor_nombre.trim() || "—";
  const totalDias = calcularDiasSolicitadosInclusive(row.fecha_inicio, row.fecha_fin);
  const saldoRestante = Math.max(0, extra.saldo_actual - totalDias);
  const tipoBadge =
    row.tipo === "vacaciones" ? SD_COPY.badgeVacacionesPendiente
    : row.tipo === "home_office" ? SD_COPY.badgeHomeOfficePendiente
    : row.tipo === "permiso_sin_goce_sueldo" ? "Permiso sin goce · Pendiente"
    : row.tipo === "matrimonio" ? "Matrimonio · Pendiente"
    : row.tipo === "incapacidad_interna" ? "Incapacidad interna · Pendiente"
    : row.tipo === "defuncion" ? "Defunción · Pendiente"
    : "Paternidad · Pendiente";
  const comentarioApi =
    typeof row.comentarios === "string" && row.comentarios.trim() ? row.comentarios.trim() : "";
  const comentarioEmp = comentarioApi || extra.comentario_empleado.trim();
  const idEmpleadoUi = formatNoEmpleadoDisplay(row.empleado_no_empleado) || "—";
  const puestoUi =
    typeof row.empleado_puesto === "string" && row.empleado_puesto.trim() ? row.empleado_puesto.trim() : extra.puesto;

  return {
    id: String(row.id),
    estado: "pending",
    empleado: {
      nombre,
      id_empleado: idEmpleadoUi,
      area: row.area.trim() || "—",
      puesto: puestoUi,
      supervisor,
    },
    solicitud: {
      tipo_badge: tipoBadge,
      tipo_codigo: row.tipo,
      fecha_inicio: fmtFechaDisplay(row.fecha_inicio),
      fecha_fin: fmtFechaDisplay(row.fecha_fin),
      total_dias: totalDias,
      comentario_empleado: comentarioEmp || SD_COPY.sinComentarioEmpleado,
      saldo_actual: extra.saldo_actual,
      saldo_restante: saldoRestante,
    },
  };
}
