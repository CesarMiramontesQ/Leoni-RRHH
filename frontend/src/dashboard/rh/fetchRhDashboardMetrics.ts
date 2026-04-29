import type { RhOperationalMetricsPayload } from "./metricsTypes.ts";
import { EMPTY_RH_OPERATIONAL_METRICS } from "./metricsMock.ts";
import {
  getComedorRhProximosRegistros,
  getComedorRhResumenDiario,
  type ComedorRhProximoRegistroApi,
} from "../../api/comedor.ts";
import { getSolicitudesRows } from "../../api/solicitudes.ts";

function isExternalRecord(item: ComedorRhProximoRegistroApi): boolean {
  const noEmpleado = (item.no_empleado ?? "").toUpperCase();
  const nombre = (item.empleado_nombre ?? "").toUpperCase();
  return noEmpleado.startsWith("EXT-") || nombre.startsWith("EXTERNO ");
}

function parseIsoDateAsUtcDay(isoDate: string): number | null {
  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return Date.UTC(year, month - 1, day);
}

/**
 * Fuente de métricas operativas RH.
 * Hidrata métricas operativas para tarjetas RH (comedor y vacaciones pendientes).
 */
export async function fetchRhDashboardMetrics(): Promise<RhOperationalMetricsPayload | null> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayUtcDay = parseIsoDateAsUtcDay(todayIso);
  const [resumen, primeraPagina] = await Promise.all([
    getComedorRhResumenDiario(todayIso, todayIso),
    getComedorRhProximosRegistros(1, 50, { filtroEstado: "todos" }),
  ]);
  const row = resumen.find((item) => item.fecha === todayIso) ?? null;
  const caseras = Math.max(0, row?.caseras ?? 0);
  const saludables = Math.max(0, row?.saludables ?? 0);

  const totalPages = Math.max(1, Math.ceil((primeraPagina.total ?? 0) / primeraPagina.page_size));
  const allItems: ComedorRhProximoRegistroApi[] = [...primeraPagina.items];
  if (totalPages > 1) {
    const pages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, idx) =>
        getComedorRhProximosRegistros(idx + 2, 50, { filtroEstado: "todos" }),
      ),
    );
    for (const page of pages) allItems.push(...page.items);
  }

  const comidasPersonalExterno = allItems.filter(
    (item) => item.fecha_servicio === todayIso && isExternalRecord(item),
  ).length;

  // Respeta el límite del endpoint (`limit <= 100`) para evitar errores 422.
  const solicitudes = await getSolicitudesRows(100);
  const vacacionesPendientes = solicitudes.filter(
    (solicitud) => solicitud.tipo === "vacaciones" && solicitud.estado === "pending",
  );
  const vacacionesUrgentes = vacacionesPendientes.filter((solicitud) => {
    if (todayUtcDay === null) return false;
    const startUtcDay = parseIsoDateAsUtcDay(solicitud.fecha_inicio);
    if (startUtcDay === null) return false;
    const diffDays = Math.floor((startUtcDay - todayUtcDay) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays < 7;
  }).length;

  return {
    ...EMPTY_RH_OPERATIONAL_METRICS,
    vacaciones_pendientes: {
      total: vacacionesPendientes.length,
      requieren_accion_hoy: vacacionesUrgentes,
      link_href: "#/solicitudes?tipo=vacaciones&estado=pending",
    },
    almuerzos_hoy: {
      total: caseras + saludables,
      capacidad_max: null,
      normal: caseras,
      dieta: saludables,
    },
    personal_externo: {
      por_registrar: comidasPersonalExterno,
      mostrar_alerta: false,
    },
  };
}
